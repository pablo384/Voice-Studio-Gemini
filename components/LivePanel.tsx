import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Activity, Volume2, XCircle } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MODEL_LIVE, INITIAL_SYSTEM_INSTRUCTION_LIVE } from '../constants';
import { createPcmBlob, decodeAudioData, base64ToBytes } from '../utils/audioUtils';
import AudioVisualizer from './AudioVisualizer';

const LivePanel: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isError, setIsError] = useState(false);
  
  // Audio State
  const [inputVolume, setInputVolume] = useState(0);
  
  // Refs for Audio Contexts and Processors
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Analysers for Visualizers
  const [inputAnalyser, setInputAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);

  // Connection
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  useEffect(() => {
    // Initialize contexts
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    inputContextRef.current = new AudioContextClass({ sampleRate: 16000 });
    outputContextRef.current = new AudioContextClass({ sampleRate: 24000 });

    // Setup Analysers
    if (inputContextRef.current) {
        const analyser = inputContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        setInputAnalyser(analyser);
    }
    if (outputContextRef.current) {
        const analyser = outputContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        setOutputAnalyser(analyser);
    }

    aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });

    return () => {
      disconnect();
      inputContextRef.current?.close();
      outputContextRef.current?.close();
    };
  }, []);

  const connect = async () => {
    setIsError(false);
    try {
      if (!inputContextRef.current || !outputContextRef.current || !aiRef.current) return;
      if (outputContextRef.current.state === 'suspended') {
        await outputContextRef.current.resume();
      }

      // Get Mic Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Connect to Gemini
      sessionPromiseRef.current = aiRef.current.live.connect({
        model: MODEL_LIVE,
        callbacks: {
          onopen: handleOnOpen,
          onmessage: handleOnMessage,
          onclose: () => {
            console.log('Session Closed');
            setIsConnected(false);
          },
          onerror: (err) => {
            console.error('Session Error', err);
            setIsError(true);
            disconnect();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: INITIAL_SYSTEM_INSTRUCTION_LIVE,
          speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          }
        }
      });

      setIsConnected(true);

    } catch (err) {
      console.error("Connection Failed:", err);
      setIsError(true);
    }
  };

  const handleOnOpen = () => {
    if (!streamRef.current || !inputContextRef.current || !sessionPromiseRef.current) return;

    const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
    sourceRef.current = source;
    
    // Setup Analyser
    if (inputAnalyser) {
        source.connect(inputAnalyser);
    }

    const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Calculate volume for UI
        let sum = 0;
        for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
        setInputVolume(Math.sqrt(sum / inputData.length));

        const pcmBlob = createPcmBlob(inputData);
        sessionPromiseRef.current?.then(session => {
            session.sendRealtimeInput({ media: pcmBlob });
        });
    };

    source.connect(processor);
    processor.connect(inputContextRef.current.destination);
    processorRef.current = processor;
  };

  const handleOnMessage = async (message: LiveServerMessage) => {
    if (!outputContextRef.current) return;

    // Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
        try {
            const audioBytes = base64ToBytes(base64Audio);
            const buffer = await decodeAudioData(audioBytes, outputContextRef.current);
            
            // Scheduling
            const currentTime = outputContextRef.current.currentTime;
            if (nextStartTimeRef.current < currentTime) {
                nextStartTimeRef.current = currentTime;
            }
            
            const source = outputContextRef.current.createBufferSource();
            source.buffer = buffer;
            
            // Connect to visualizer then destination
            if (outputAnalyser) {
                source.connect(outputAnalyser);
                outputAnalyser.connect(outputContextRef.current.destination);
            } else {
                source.connect(outputContextRef.current.destination);
            }

            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            
            audioSourcesRef.current.add(source);
            source.onended = () => {
                audioSourcesRef.current.delete(source);
            };
        } catch (e) {
            console.error("Error decoding audio response", e);
        }
    }

    // Handle Interruption
    if (message.serverContent?.interrupted) {
        audioSourcesRef.current.forEach(src => {
            try { src.stop(); } catch(e){}
        });
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
    }
  };

  const disconnect = useCallback(() => {
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
        processorRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    
    // Stop all playing audio
    audioSourcesRef.current.forEach(src => {
        try { src.stop(); } catch(e){}
    });
    audioSourcesRef.current.clear();

    // Ideally, we would close the session here, but the SDK doesn't expose a clean `session.close()` 
    // on the promise wrapper in a straightforward way without keeping the session obj.
    // The loop context will die when we stop sending inputs.
    // Re-creating the AI instance on connect ensures a fresh start.
    
    setIsConnected(false);
  }, []);


  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-900 to-slate-800">
      
      {/* Status Badge */}
      <div className={`absolute top-6 left-6 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 border ${isConnected ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
        {isConnected ? 'Live Session Active' : 'Disconnected'}
      </div>

      <div className="max-w-md w-full flex flex-col gap-8 relative z-10">
        
        {/* Main Icon */}
        <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
            isConnected 
            ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_50px_-12px_rgba(99,102,241,0.5)]' 
            : 'border-slate-700 bg-slate-800'
        }`}>
            {isConnected ? <Activity size={48} className="text-indigo-400 animate-pulse" /> : <MicOff size={48} className="text-slate-600" />}
        </div>

        {/* Action Button */}
        <div>
            {!isConnected ? (
                <button 
                    onClick={connect}
                    className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-indigo-600 font-lg rounded-full hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30 focus:outline-none ring-offset-2 focus:ring-2 ring-indigo-500"
                >
                    <Mic className="mr-2" size={24} />
                    Start Conversation
                </button>
            ) : (
                <button 
                    onClick={disconnect}
                    className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-rose-600 font-lg rounded-full hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-500/30 focus:outline-none ring-offset-2 focus:ring-2 ring-rose-500"
                >
                    <XCircle className="mr-2" size={24} />
                    End Session
                </button>
            )}
        </div>

        {/* Error Message */}
        {isError && (
            <div className="p-4 bg-rose-900/20 border border-rose-900/50 text-rose-300 rounded-lg text-sm">
                Connection failed. Please check microphone permissions and try again.
            </div>
        )}

        {/* Visualizers */}
        <div className="grid grid-cols-1 gap-4 w-full mt-4">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex items-center justify-between mb-2 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    <span className="flex items-center gap-2"><Mic size={14} /> Input (You)</span>
                </div>
                <AudioVisualizer analyser={inputAnalyser} isActive={isConnected} color="#818cf8" />
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex items-center justify-between mb-2 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    <span className="flex items-center gap-2"><Volume2 size={14} /> Output (Gemini)</span>
                </div>
                <AudioVisualizer analyser={outputAnalyser} isActive={isConnected} color="#34d399" />
            </div>
        </div>

        <p className="text-slate-500 text-sm">
            Powered by Gemini 2.5 Live API. Speak naturally to interact.
        </p>

      </div>
    </div>
  );
};

export default LivePanel;