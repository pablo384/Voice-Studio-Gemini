import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Download, Wand2, Loader2, Music2, User, Settings2, Gauge, Activity, Globe } from 'lucide-react';
import { VOICE_PROFILES, SUPPORTED_LANGUAGES } from '../constants';
import { generateSpeech, generateFastResponse } from '../services/geminiService';
import { base64ToBytes, decodeAudioData, createWavBlobFromPCM } from '../utils/audioUtils';
import { AgeGroup, Gender } from '../types';

const TTSPanel: React.FC = () => {
  const [text, setText] = useState('Welcome to the Gemini Voice Studio. Select a voice and I will speak this text for you.');
  const [selectedVoice, setSelectedVoice] = useState(VOICE_PROFILES[2]); // Default to Kore (Mid Female)
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedAudioBuffer, setGeneratedAudioBuffer] = useState<AudioBuffer | null>(null);
  const [rawAudioData, setRawAudioData] = useState<Uint8Array | null>(null);
  
  // Audio Controls
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [playbackPitch, setPlaybackPitch] = useState(0); // Semitones

  // Filters
  const [genderFilter, setGenderFilter] = useState<Gender | 'All'>('All');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // Init Audio Context on mount (suspended state initially usually)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // Update running source parameters when controls change
  useEffect(() => {
    if (sourceNodeRef.current && audioContextRef.current) {
        const ct = audioContextRef.current.currentTime;
        try {
            sourceNodeRef.current.playbackRate.setValueAtTime(playbackSpeed, ct);
            sourceNodeRef.current.detune.setValueAtTime(playbackPitch * 100, ct);
        } catch(e) {
            // Ignore errors if source is stopped or invalid
        }
    }
  }, [playbackSpeed, playbackPitch]);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setIsLoading(true);
    stopAudio(); // Stop any current playback

    try {
      const base64Audio = await generateSpeech(text, selectedVoice.name, selectedLanguage);
      if (base64Audio && audioContextRef.current) {
        const audioBytes = base64ToBytes(base64Audio);
        setRawAudioData(audioBytes);
        const buffer = await decodeAudioData(audioBytes, audioContextRef.current);
        setGeneratedAudioBuffer(buffer);
        playAudio(buffer);
      }
    } catch (e) {
      alert("Failed to generate speech. Please check your API key.");
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = async (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;
    
    // Ensure context is running
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    stopAudio();

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    
    // Apply current settings
    source.playbackRate.value = playbackSpeed;
    source.detune.value = playbackPitch * 100;

    source.connect(audioContextRef.current.destination);
    source.onended = () => setIsPlaying(false);
    
    sourceNodeRef.current = source;
    source.start();
    setIsPlaying(true);
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleDownload = () => {
    if (!rawAudioData) return;
    
    // Create WAV blob from raw PCM
    const blob = createWavBlobFromPCM(rawAudioData);
    const url = URL.createObjectURL(blob);
    
    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-studio-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSuggestText = async () => {
    setIsLoading(true);
    try {
      const prompt = `Write a short, engaging paragraph (approx 30 words) about a futuristic technology or a calm nature scene in ${selectedLanguage}. Only return the text.`;
      const suggestion = await generateFastResponse(prompt);
      setText(suggestion);
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const filteredVoices = VOICE_PROFILES.filter(v => genderFilter === 'All' || v.gender === genderFilter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Left Column: Controls & Input */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 flex-1 flex flex-col min-h-[300px]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
              <span className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Wand2 size={20} /></span>
              Text Input
            </h2>
            <button 
              onClick={handleSuggestText}
              className="text-xs text-indigo-300 hover:text-indigo-200 underline decoration-dotted underline-offset-4"
              disabled={isLoading}
            >
              Write for me (AI)
            </button>
          </div>
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full flex-1 bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all"
            placeholder="Type something here to convert to speech..."
          />
        </div>

        {/* Audio Settings Controls */}
        <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Settings2 size={16} className="text-slate-400"/> Playback Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Speed Control */}
                <div>
                    <div className="flex justify-between text-xs mb-3">
                        <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                            <Gauge size={14}/> Speed
                        </span>
                        <span className="bg-slate-700/50 px-2 py-0.5 rounded text-indigo-300 font-mono border border-slate-600/50">
                            {playbackSpeed.toFixed(1)}x
                        </span>
                    </div>
                    <div className="relative flex items-center h-6">
                        <input 
                            type="range" 
                            min="0.5" 
                            max="2.0" 
                            step="0.1"
                            value={playbackSpeed}
                            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium mt-1">
                        <span>0.5x</span>
                        <span>1.0x</span>
                        <span>2.0x</span>
                    </div>
                </div>
                
                {/* Pitch Control */}
                <div>
                    <div className="flex justify-between text-xs mb-3">
                        <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                            <Activity size={14}/> Pitch
                        </span>
                        <span className="bg-slate-700/50 px-2 py-0.5 rounded text-pink-300 font-mono border border-slate-600/50">
                            {playbackPitch > 0 ? '+' : ''}{playbackPitch} st
                        </span>
                    </div>
                    <div className="relative flex items-center h-6">
                        <input 
                            type="range" 
                            min="-12" 
                            max="12" 
                            step="1"
                            value={playbackPitch}
                            onChange={(e) => setPlaybackPitch(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium mt-1">
                        <span>Low (-12)</span>
                        <span>Normal</span>
                        <span>High (+12)</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Playback Bar */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center gap-4 shadow-lg">
          <button
            onClick={isPlaying ? stopAudio : () => generatedAudioBuffer ? playAudio(generatedAudioBuffer) : handleGenerate()}
            disabled={isLoading}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isPlaying 
                ? 'bg-rose-500 hover:bg-rose-600 text-white' 
                : 'bg-indigo-500 hover:bg-indigo-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20`}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : isPlaying ? <Square fill="currentColor" size={20} /> : <Play fill="currentColor" className="ml-1" size={20} />}
          </button>
          
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-300 mb-1">
              {isLoading ? 'Generating Audio...' : isPlaying ? 'Playing...' : generatedAudioBuffer ? 'Ready to play' : 'Waiting for input'}
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
               {isLoading && <div className="h-full bg-indigo-500 w-1/3 animate-loading-bar"></div>}
               {isPlaying && <div className="h-full bg-green-500 w-full animate-pulse"></div>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
               onClick={handleDownload}
               disabled={!rawAudioData || isLoading}
               className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
               title="Download MP3/WAV"
            >
              <Download size={20} />
            </button>
            <div className="w-px h-6 bg-slate-700 mx-2"></div>
            <button 
               onClick={handleGenerate}
               disabled={isLoading || !text}
               className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Voice Selection */}
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 flex flex-col h-full overflow-hidden">
        <h2 className="text-xl font-semibold text-slate-100 mb-6 flex items-center gap-2">
          <span className="p-2 bg-pink-500/20 rounded-lg text-pink-400"><User size={20} /></span>
          Voice & Language
        </h2>
        
        {/* Language Selection */}
        <div className="mb-6 space-y-2">
           <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
             <Globe size={14} /> Language
           </label>
           <div className="relative">
             <select 
               value={selectedLanguage}
               onChange={(e) => setSelectedLanguage(e.target.value)}
               className="w-full appearance-none bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer hover:border-slate-600 transition-all"
             >
               {SUPPORTED_LANGUAGES.map(lang => (
                 <option key={lang} value={lang}>{lang}</option>
               ))}
             </select>
             <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
               <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
               </svg>
             </div>
           </div>
        </div>

        <div className="h-px bg-slate-700/50 mb-6"></div>

        {/* Filters */}
        <div className="flex justify-between items-center mb-4">
           <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Voice Profile</label>
           <div className="flex gap-1 p-0.5 bg-slate-900/50 rounded-lg border border-slate-700/50">
              {(['All', 'Male', 'Female'] as const).map(g => (
                <button
                 key={g}
                 onClick={() => setGenderFilter(g as any)}
                 className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${
                   genderFilter === g ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
                 }`}
                >
                  {g}
                </button>
              ))}
           </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {filteredVoices.map((voice) => (
            <div 
              key={voice.name}
              onClick={() => setSelectedVoice(voice)}
              className={`p-3 rounded-xl border cursor-pointer transition-all group ${
                selectedVoice.name === voice.name 
                  ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/20' 
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`font-semibold ${selectedVoice.name === voice.name ? 'text-indigo-400' : 'text-slate-200'}`}>
                  {voice.name}
                </span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-700">
                  {voice.gender}
                </span>
              </div>
              <div className="flex gap-2 text-xs text-slate-400 mb-2">
                 <span>{voice.ageGroup}</span> • <span>{voice.description}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                <Music2 size={12} />
                <span>Preview available</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes loading-bar {
          0% { margin-left: -30%; width: 30%; }
          50% { width: 60%; }
          100% { margin-left: 100%; width: 30%; }
        }
        .animate-loading-bar {
          animation: loading-bar 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
};

export default TTSPanel;