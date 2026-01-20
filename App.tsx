
import React, { useState, useEffect, useRef } from 'react';
import { Scene, AppStatus, VisualStyle, VISUAL_STYLES, CharacterProfile } from './types';
import { analyzeScript, generateSceneImage, refineScriptForYoutube, generateCharacterImage } from './services/geminiService';
import { saveProject, loadProject, clearProject } from './services/storageService';
import Header from './components/Header';
import StoryboardCard from './components/StoryboardCard';
import StoryboardMatchingTable from './components/StoryboardMatchingTable';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';

const PROJECT_ID = 'STORYBOARD_PRO_PROJECT';

const App: React.FC = () => {
  const [script, setScript] = useState<string>('');
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [isRefined, setIsRefined] = useState<boolean>(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>([]);
  const [selectedScenes, setSelectedScenes] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [generatingSceneIds, setGeneratingSceneIds] = useState<Set<number>>(new Set());
  const [isGeneratingAllScenes, setIsGeneratingAllScenes] = useState<boolean>(false);
  const [isGeneratingAllCharacters, setIsGeneratingAllCharacters] = useState<boolean>(false);
  const [selectedStyle, setSelectedStyle] = useState<VisualStyle>('Default');
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(1);

  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState<boolean>(false);
  const isResetting = useRef<boolean>(false);

  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const saved = await loadProject(PROJECT_ID);
        if (saved) {
          if (saved.script !== undefined) setScript(saved.script);
          if (saved.scenes !== undefined) {
            setScenes(saved.scenes);
            if (saved.scenes.length > 0) setRangeEnd(saved.scenes.length);
          }
          if (saved.characterProfiles !== undefined) setCharacterProfiles(saved.characterProfiles);
          if (saved.activeStep !== undefined) setActiveStep(saved.activeStep);
          if (saved.selectedStyle !== undefined) setSelectedStyle(saved.selectedStyle);
          if (saved.selectedScenes !== undefined) setSelectedScenes(new Set(saved.selectedScenes));
          if (saved.isRefined !== undefined) setIsRefined(saved.isRefined);
        }
      } catch (e) {
        console.error("Failed to load project", e);
      } finally {
        setIsInitialLoadComplete(true);
      }
    };
    loadSavedData();
  }, []);

  useEffect(() => {
    if (!isInitialLoadComplete || isResetting.current) return;
    const saveData = async () => {
      try {
        const dataToSave = {
          script, scenes, characterProfiles, activeStep, selectedStyle,
          selectedScenes: Array.from(selectedScenes), isRefined,
          lastUpdated: new Date().getTime()
        };
        await saveProject(PROJECT_ID, dataToSave);
      } catch (e) {
        console.error("Failed to save project", e);
      }
    };
    saveData();
  }, [script, scenes, characterProfiles, activeStep, selectedStyle, selectedScenes, isRefined, isInitialLoadComplete]);

  const handleReset = async () => {
    if (window.confirm("주의: 모든 작업 내용(대본, 이미지)이 영구적으로 삭제됩니다. 정말 새로 시작하시겠습니까?")) {
      isResetting.current = true;
      try {
        await clearProject(PROJECT_ID);
        localStorage.clear();
        sessionStorage.clear();
        setScript('');
        setScenes([]);
        setCharacterProfiles([]);
        setActiveStep(1);
        window.location.reload();
      } catch (e) {
        console.error("Reset failed", e);
        alert("데이터 삭제 중 오류가 발생했습니다. 브라우저를 새로고침 해보세요.");
        isResetting.current = false;
      }
    }
  };

  const handleRefineScript = async () => {
    if (!script.trim()) return;
    setIsRefining(true);
    try {
      const refined = await refineScriptForYoutube(script);
      setScript(refined);
      setIsRefined(true);
    } catch (err: any) { alert(err.message); } finally { setIsRefining(false); }
  };

  const handleDownloadScript = () => {
    if (!script.trim()) return alert("다운로드할 대본 내용이 없습니다.");
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `optimized_script_${new Date().getTime()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAnalyze = async () => {
    if (!script.trim()) return;
    setStatus(AppStatus.ANALYZING);
    try {
      const { scenes: analyzedScenes, characters: analyzedCharacters } = await analyzeScript(script);
      setScenes(analyzedScenes);
      setCharacterProfiles(analyzedCharacters);
      setSelectedScenes(new Set(analyzedScenes.map(s => s.sceneNumber)));
      setRangeStart(1);
      setRangeEnd(analyzedScenes.length);
      setActiveStep(2);
    } catch (err: any) { alert("분석 오류가 발생했습니다."); } finally { setStatus(AppStatus.IDLE); }
  };

  const handleGenerateCharacter = async (id: string) => {
    const profile = characterProfiles.find(p => p.id === id);
    if (!profile) return;
    setCharacterProfiles(prev => prev.map(p => p.id === id ? { ...p, isGenerating: true } : p));
    try {
      const img = await generateCharacterImage(profile, selectedStyle);
      setCharacterProfiles(prev => prev.map(p => p.id === id ? { ...p, imageUrl: img, isGenerating: false } : p));
    } catch (err) {
      setCharacterProfiles(prev => prev.map(p => p.id === id ? { ...p, isGenerating: false } : p));
    }
  };

  const handleGenerateAllCharacters = async () => {
    setIsGeneratingAllCharacters(true);
    for (const char of characterProfiles) {
      if (!char.imageUrl) await handleGenerateCharacter(char.id);
    }
    setIsGeneratingAllCharacters(false);
  };

  const handleDownloadAllCharacters = async () => {
    const generated = characterProfiles.filter(p => p.imageUrl);
    if (generated.length === 0) return alert("생성된 인물 이미지가 없습니다.");
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("characters");
      generated.forEach(p => {
        const base64 = p.imageUrl!.split(',')[1];
        folder?.file(`${p.name.replace(/\s/g, '_')}.png`, base64, { base64: true });
      });
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `characters_${new Date().getTime()}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("압축 중 오류 발생");
    } finally {
      setIsZipping(false);
    }
  };

  const handleGenerateImage = async (sceneNumber: number) => {
    setGeneratingSceneIds(prev => new Set(prev).add(sceneNumber));
    try {
      const scene = scenes.find(s => s.sceneNumber === sceneNumber);
      if (!scene) return;
      const img = await generateSceneImage(scene.visualPrompt, selectedStyle, characterProfiles);
      setScenes(prev => prev.map(s => s.sceneNumber === sceneNumber ? { ...s, generatedImageUrl: img } : s));
    } catch (err) { console.error(err); } finally {
      setGeneratingSceneIds(prev => {
        const n = new Set(prev);
        n.delete(sceneNumber);
        return n;
      });
    }
  };

  const handleGenerateRangeImages = async () => {
    if (rangeStart > rangeEnd) return alert("시작 번호가 끝 번호보다 클 수 없습니다.");
    const toGenerate = scenes.filter(s => s.sceneNumber >= rangeStart && s.sceneNumber <= rangeEnd && !s.generatedImageUrl);
    if (toGenerate.length === 0) return alert("해당 범위에 이미지가 생성되지 않은 장면이 없습니다.");
    
    setIsGeneratingAllScenes(true);
    for (const scene of toGenerate) {
      await handleGenerateImage(scene.sceneNumber);
    }
    setIsGeneratingAllScenes(false);
  };

  const handleDownloadRangeImages = async () => {
    const rangeScenes = scenes.filter(s => s.sceneNumber >= rangeStart && s.sceneNumber <= rangeEnd && s.generatedImageUrl);
    if (rangeScenes.length === 0) return alert(`${rangeStart}번부터 ${rangeEnd}번 사이에 생성된 이미지가 없습니다.`);
    
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const imgFolder = zip.folder(`images_${rangeStart}_to_${rangeEnd}`);
      rangeScenes.forEach((scene) => {
        const base64Data = scene.generatedImageUrl!.split(',')[1];
        imgFolder?.file(`scene_${String(scene.sceneNumber).padStart(3, '0')}.png`, base64Data, { base64: true });
      });
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `storyboard_images_${rangeStart}_${rangeEnd}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("이미지 압축 중 오류가 발생했습니다.");
    } finally {
      setIsZipping(false);
    }
  };

  if (!isInitialLoadComplete) {
    return <div className="h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white font-black italic uppercase">Restoring project...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f172a] text-slate-200 overflow-hidden font-sans">
      <Header currentStep={activeStep} onStepClick={setActiveStep} onReset={handleReset} />
      
      <main className="flex-1 flex overflow-hidden">
        {activeStep >= 2 && (
          <aside className="w-80 bg-[#1e293b] border-r border-slate-800 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar no-print shadow-2xl">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Project Control</label>
              <button onClick={handleReset} className="w-full py-3 bg-red-600 text-white text-[10px] font-black rounded-lg hover:bg-red-500 transition-all uppercase italic shadow-lg">현재 프로젝트 초기화</button>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">스타일 필터</label>
              <div className="grid grid-cols-1 gap-2">
                {VISUAL_STYLES.map(style => (
                  <button key={style.id} onClick={() => setSelectedStyle(style.id)} className={`p-3 rounded-lg text-left transition-all border ${selectedStyle === style.id ? 'bg-slate-700 border-[#DFFF00]' : 'bg-slate-900/50 border-white/5 hover:border-white/20'}`}>
                    <div className={`text-[11px] font-black ${selectedStyle === style.id ? 'text-[#DFFF00]' : 'text-white'}`}>{style.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {activeStep === 1 && (
            <div className="max-w-4xl mx-auto py-10 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black italic uppercase"><span className="text-[#DFFF00]">/</span> 1. 대본 입력</h2>
                <div className="flex gap-2">
                  <button onClick={handleReset} className="px-4 py-2 bg-red-600 text-white text-[10px] font-black rounded-lg uppercase transition-all shadow-md">초기화</button>
                  <button onClick={handleDownloadScript} className="px-4 py-2 bg-slate-700 text-white text-[10px] font-black rounded-lg uppercase transition-all shadow-md hover:bg-slate-600">대본 다운로드 (.txt)</button>
                  <button onClick={handleRefineScript} disabled={isRefining} className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase shadow-md hover:bg-blue-500">{isRefining ? '최적화 중...' : '유튜브 정책 최적화'}</button>
                </div>
              </div>
              <textarea value={script} onChange={e => setScript(e.target.value)} className="w-full h-[500px] bg-[#1e293b] border border-slate-700 rounded-2xl p-8 text-white text-lg focus:ring-2 focus:ring-[#DFFF00] outline-none transition-all resize-none leading-relaxed" placeholder="대본을 입력하세요..." />
              <button onClick={handleAnalyze} className="w-full py-6 bg-[#DFFF00] text-black font-black rounded-2xl text-xl italic uppercase shadow-xl hover:scale-[1.01] transition-all">분석 및 스토리보드 생성 시작</button>
            </div>
          )}

          {activeStep === 2 && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black italic uppercase">2. Scene List ({scenes.length})</h2>
                <div className="flex gap-3">
                  <button onClick={handleReset} className="px-6 py-3 bg-red-600 text-white font-black rounded-lg text-xs uppercase">초기화</button>
                  <button onClick={() => setActiveStep(3)} className="px-8 py-3 bg-[#DFFF00] text-black font-black rounded-lg italic uppercase hover:scale-[1.02] transition-all">이미지 제작 단계 이동</button>
                </div>
              </div>
              <div className="bg-[#1e293b] p-8 rounded-2xl border border-slate-800 font-mono text-[12px] text-emerald-400 max-h-[70vh] overflow-auto shadow-inner">
                {scenes.map(s => (
                  <div key={s.sceneNumber} className="border-b border-white/5 pb-2 mb-2">#{String(s.sceneNumber).padStart(3, '0')} - {s.narrative}</div>
                ))}
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-12">
              <section className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black italic uppercase">등장인물 설정</h3>
                  <div className="flex gap-2">
                    <button onClick={handleGenerateAllCharacters} disabled={isGeneratingAllCharacters} className="px-4 py-2 bg-slate-800 text-white text-[10px] font-black rounded hover:bg-slate-700 transition-all italic">인물 전체 생성</button>
                    <button onClick={handleDownloadAllCharacters} disabled={isZipping} className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black rounded hover:bg-blue-500 transition-all italic">{isZipping ? '압축 중...' : '인물 ZIP 다운로드'}</button>
                  </div>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {characterProfiles.map(profile => (
                    <div key={profile.id} className="min-w-[140px] bg-[#1e293b] rounded-xl border border-slate-800 overflow-hidden flex flex-col group relative shadow-lg">
                      <div className="aspect-square bg-black relative">
                        {profile.imageUrl ? <img src={profile.imageUrl} className="w-full h-full object-cover" /> : 
                        <div className="w-full h-full flex items-center justify-center text-[8px] uppercase italic text-slate-700">{profile.isGenerating ? 'Generating...' : 'Empty'}</div>}
                        <button onClick={() => handleGenerateCharacter(profile.id)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[9px] font-black text-[#DFFF00] uppercase italic">재생성</button>
                      </div>
                      <div className="p-2 bg-[#111827] text-[10px] font-black text-white truncate">{profile.name}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-6">
                <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <label className="text-[9px] font-black text-slate-500 uppercase mb-1.5 ml-1">시작 번호</label>
                      <input type="number" value={rangeStart} onChange={e => setRangeStart(Number(e.target.value))} className="w-20 bg-black/40 border border-slate-700 rounded-lg px-3 py-2 text-sm text-[#DFFF00] font-black focus:border-[#DFFF00] outline-none" />
                    </div>
                    <span className="text-slate-700 font-black mt-5">~</span>
                    <div className="flex flex-col">
                      <label className="text-[9px] font-black text-slate-500 uppercase mb-1.5 ml-1">끝 번호</label>
                      <input type="number" value={rangeEnd} onChange={e => setRangeEnd(Number(e.target.value))} className="w-20 bg-black/40 border border-slate-700 rounded-lg px-3 py-2 text-sm text-[#DFFF00] font-black focus:border-[#DFFF00] outline-none" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleGenerateRangeImages} disabled={isGeneratingAllScenes} className="px-6 py-3 bg-[#e91e63] text-white text-[11px] font-black rounded-xl uppercase italic shadow-lg hover:scale-105 transition-all">구간 일괄 생성</button>
                    <button onClick={handleDownloadRangeImages} disabled={isZipping} className="px-6 py-3 bg-blue-600 text-white text-[11px] font-black rounded-xl uppercase italic shadow-lg hover:scale-105 transition-all">구간 일괄 다운로드</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {scenes.map(scene => (
                    <StoryboardCard 
                      key={scene.sceneNumber} 
                      scene={scene} 
                      onGenerateImage={handleGenerateImage} 
                      onGenerateVideo={() => alert('준비 중')} 
                      onUpdatePrompt={p => setScenes(prev => prev.map(s => s.sceneNumber === scene.sceneNumber ? { ...s, visualPrompt: p } : s))} 
                      isGeneratingImage={generatingSceneIds.has(scene.sceneNumber)} 
                      isGeneratingVideo={false} 
                      isSelected={selectedScenes.has(scene.sceneNumber)} 
                      onToggleSelect={id => setSelectedScenes(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })} 
                    />
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeStep === 4 && <StoryboardMatchingTable scenes={scenes} onBack={() => setActiveStep(3)} />}
          {activeStep === 5 && <div className="p-10 bg-[#1e293b] rounded-2xl font-mono text-xs text-emerald-400 overflow-auto max-h-[70vh] shadow-inner">{JSON.stringify({ project: PROJECT_ID, totalScenes: scenes.length, scenes }, null, 2)}</div>}
        </div>
      </main>

      {status === AppStatus.ANALYZING && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-[#DFFF00] rounded-full animate-spin"></div>
          <div className="text-white font-black italic uppercase tracking-widest animate-pulse">Analyzing and Building Storyboard...</div>
        </div>
      )}
    </div>
  );
};

export default App;
