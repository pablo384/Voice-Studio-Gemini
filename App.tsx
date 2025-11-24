import React, { useState } from 'react';
import { Mic, Zap, MessageSquare, Menu, AudioLines } from 'lucide-react';
import { AppTab } from './types';
import TTSPanel from './components/TTSPanel';
import LivePanel from './components/LivePanel';
import ChatPanel from './components/ChatPanel';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.TTS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Tab config
  const tabs = [
    { id: AppTab.TTS, label: 'Text to Speech', icon: AudioLines, description: 'Generate speech from text' },
    { id: AppTab.LIVE, label: 'Live Conversation', icon: Mic, description: 'Real-time voice chat' },
    { id: AppTab.CHAT, label: 'Fast Chat', icon: Zap, description: 'Low-latency text AI' },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed lg:relative z-30 w-72 h-full bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
        <div className="p-6 border-b border-slate-800/50">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
               <AudioLines className="text-white" size={24} />
             </div>
             <div>
               <h1 className="text-xl font-bold text-white tracking-tight">Voice Studio</h1>
               <p className="text-xs text-slate-500 font-medium">Gemini 2.5 Powered</p>
             </div>
           </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-slate-800 text-indigo-400 border border-slate-700/50 shadow-sm' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-indigo-500/10' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
                  <Icon size={20} />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-sm">{tab.label}</div>
                  <div className="text-[11px] opacity-70">{tab.description}</div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-semibold text-slate-400">System Status</span>
            </div>
            <div className="text-xs text-slate-500">
              API Connected. Microphone ready.
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-10">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
               <AudioLines className="text-white" size={16} />
             </div>
             <span className="font-bold text-white">Voice Studio</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400 hover:text-white">
            <Menu size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-hidden p-4 lg:p-8 bg-slate-950">
          <div className="max-w-7xl mx-auto h-full">
            {activeTab === AppTab.TTS && (
               <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <TTSPanel />
               </div>
            )}
            {activeTab === AppTab.LIVE && (
               <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <LivePanel />
               </div>
            )}
            {activeTab === AppTab.CHAT && (
               <div className="h-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <ChatPanel />
               </div>
            )}
          </div>
        </div>
      </main>

    </div>
  );
};

export default App;
