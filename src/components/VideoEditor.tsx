import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, VideoEdit, VideoAdjustments } from '../types';
import { Rnd } from 'react-rnd';
import { Play, Pause, SkipBack, SkipForward, Image as ImageIcon, Type, Settings, Trash2, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  project: ProjectState;
  updateProject: (updates: Partial<ProjectState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function VideoEditor({ project, updateProject, onNext, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);
  const [videoScale, setVideoScale] = useState(1);

  // Sync video time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      updateProject({ duration: video.duration });
      calculateScale();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [updateProject]);

  const calculateScale = () => {
    if (containerRef.current && videoRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const videoWidth = videoRef.current.videoWidth || 1280; // Default if not loaded
      const videoHeight = videoRef.current.videoHeight || 720; // Default if not loaded
      
      const scaleX = containerWidth / videoWidth;
      const scaleY = containerHeight / videoHeight;
      setVideoScale(Math.min(scaleX, scaleY) * 0.95); // 0.95 to leave a small margin
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const observer = new ResizeObserver(() => {
      calculateScale();
    });
    
    observer.observe(container);
    window.addEventListener('resize', calculateScale);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', calculateScale);
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const activeEdits = project.edits.filter(
    (edit) => currentTime >= edit.startTime && currentTime <= edit.endTime
  );

  const updateEdit = (id: string, updates: Partial<VideoEdit>) => {
    const newEdits = project.edits.map((e) => (e.id === id ? { ...e, ...updates } : e));
    updateProject({ edits: newEdits });
  };

  const deleteEdit = (id: string) => {
    updateProject({ edits: project.edits.filter((e) => e.id !== id) });
    if (selectedEditId === id) setSelectedEditId(null);
  };

  const addEdit = (type: 'text' | 'image') => {
    const newEdit: VideoEdit = {
      id: uuidv4(),
      type,
      startTime: currentTime,
      endTime: Math.min(currentTime + 5, project.duration || currentTime + 5),
      x: 100,
      y: 100,
      width: type === 'image' ? 200 : undefined,
      height: type === 'image' ? 200 : undefined,
      content: type === 'text' ? 'Novo Texto' : undefined,
      style: type === 'text' ? { fontSize: 48, color: '#ffffff', fontFamily: 'Impact', borderColor: '#000000', borderWidth: 2 } : undefined,
    };
    updateProject({ edits: [...project.edits, newEdit] });
    setSelectedEditId(newEdit.id);
  };

  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      updateEdit(id, { imageUrl: url });
    }
  };

  const selectedEdit = project.edits.find((e) => e.id === selectedEditId);

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-120px)] min-h-[600px] lg:min-h-0">
      {/* Left Panel: Video Preview */}
      <div className="flex-1 flex flex-col bg-[#212121] rounded-xl overflow-hidden shadow-lg border border-[#3d3d3d] min-h-[400px]">
        <div className="bg-[#1a1a1a] p-3 border-b border-[#3d3d3d] flex justify-between items-center">
          <h2 className="font-semibold flex items-center gap-2">
            <i className="fa-solid fa-film text-[#ff0000]"></i> Preview
          </h2>
          <div className="flex gap-2">
            <button onClick={() => addEdit('text')} className="bg-[#3d3d3d] hover:bg-[#4d4d4d] p-2 rounded-md text-sm flex items-center gap-1" title="Adicionar Texto">
              <Type className="w-4 h-4" /> Texto
            </button>
            <button onClick={() => addEdit('image')} className="bg-[#3d3d3d] hover:bg-[#4d4d4d] p-2 rounded-md text-sm flex items-center gap-1" title="Adicionar Imagem">
              <ImageIcon className="w-4 h-4" /> Imagem
            </button>
          </div>
        </div>

        {/* Video Container */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden" ref={containerRef}>
          {project.videoUrl && (
            <div
              className="relative"
              style={{
                width: videoRef.current?.videoWidth ? videoRef.current.videoWidth * videoScale : '100%',
                height: videoRef.current?.videoHeight ? videoRef.current.videoHeight * videoScale : '100%',
              }}
            >
              <video
                ref={videoRef}
                src={project.videoUrl}
                className="w-full h-full object-contain"
                style={{
                  filter: `brightness(${project.adjustments.brightness}%) contrast(${project.adjustments.contrast}%) saturate(${project.adjustments.saturation}%)`,
                }}
                onClick={() => setSelectedEditId(null)}
              />

              {/* Overlays */}
              {activeEdits.map((edit) => (
                <Rnd
                  key={edit.id}
                  size={edit.type === 'image' ? { width: (edit.width || 200) * videoScale, height: (edit.height || 200) * videoScale } : undefined}
                  position={{ x: edit.x * videoScale, y: edit.y * videoScale }}
                  onDragStop={(e, d) => updateEdit(edit.id, { x: d.x / videoScale, y: d.y / videoScale })}
                  onResizeStop={(e, direction, ref, delta, position) => {
                    if (edit.type === 'image') {
                      updateEdit(edit.id, {
                        width: parseFloat(ref.style.width) / videoScale,
                        height: parseFloat(ref.style.height) / videoScale,
                        x: position.x / videoScale,
                        y: position.y / videoScale,
                      });
                    } else if (edit.type === 'text') {
                      const currentFontSize = edit.style?.fontSize || 48;
                      const oldWidth = ref.offsetWidth - delta.width;
                      const widthRatio = oldWidth > 0 ? ref.offsetWidth / oldWidth : 1;
                      const oldHeight = ref.offsetHeight - delta.height;
                      const heightRatio = oldHeight > 0 ? ref.offsetHeight / oldHeight : 1;
                      
                      // Use the ratio that changed the most
                      const ratio = Math.abs(widthRatio - 1) > Math.abs(heightRatio - 1) ? widthRatio : heightRatio;
                      
                      const newFontSize = Math.max(10, Math.round(currentFontSize * ratio));
                      
                      updateEdit(edit.id, {
                        x: position.x / videoScale,
                        y: position.y / videoScale,
                        style: {
                          ...edit.style,
                          fontSize: newFontSize
                        }
                      });
                      
                      // Reset Rnd internal size style so it auto-fits the new font size
                      ref.style.width = 'auto';
                      ref.style.height = 'auto';
                    }
                  }}
                  bounds="parent"
                  className={`${selectedEditId === edit.id ? 'ring-2 ring-[#ff0000]' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEditId(edit.id);
                  }}
                  enableResizing={true}
                  lockAspectRatio={edit.type === 'text'}
                >
                  {edit.type === 'text' ? (
                    <div
                      style={{
                        fontSize: `${(edit.style?.fontSize || 48) * videoScale}px`,
                        color: edit.style?.color || '#ffffff',
                        fontFamily: edit.style?.fontFamily || 'Impact',
                        WebkitTextStroke: `${(edit.style?.borderWidth || 2) * videoScale}px ${edit.style?.borderColor || '#000000'}`,
                        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                        whiteSpace: 'nowrap',
                        cursor: 'move',
                      }}
                    >
                      {edit.content}
                    </div>
                  ) : (
                    <div className="w-full h-full relative group cursor-move">
                      {edit.imageUrl ? (
                        <img src={edit.imageUrl} alt="Overlay" className="w-full h-full object-contain pointer-events-none" />
                      ) : (
                        <div className="w-full h-full bg-[#3d3d3d]/80 border-2 border-dashed border-gray-500 flex flex-col items-center justify-center text-center p-2">
                          <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                          <span className="text-xs text-gray-300">{edit.description || 'Imagem sugerida'}</span>
                          <label className="mt-2 bg-[#ff0000] text-white text-xs px-2 py-1 rounded cursor-pointer hover:bg-[#cc0000]">
                            Fazer Upload
                            <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleImageUpload(edit.id, e)} />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </Rnd>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-[#1a1a1a] p-4 border-t border-[#3d3d3d]">
          <div className="flex items-center gap-4 mb-2">
            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; }} className="text-gray-400 hover:text-white">
              <SkipBack className="w-5 h-5" />
            </button>
            <button onClick={togglePlay} className="bg-[#ff0000] hover:bg-[#cc0000] text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
            </button>
            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = project.duration; }} className="text-gray-400 hover:text-white">
              <SkipForward className="w-5 h-5" />
            </button>
            <div className="text-sm font-mono text-gray-400 ml-2">
              {currentTime.toFixed(2)}s / {project.duration.toFixed(2)}s
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={project.duration || 100}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-[#ff0000] h-2 bg-[#3d3d3d] rounded-lg appearance-none cursor-pointer"
          />
          
          {/* Timeline visualization for edits */}
          <div className="relative w-full h-6 mt-2 bg-[#0f0f0f] rounded overflow-hidden">
            {project.edits.map(edit => (
              <div
                key={edit.id}
                className={`absolute h-full rounded-sm cursor-pointer ${selectedEditId === edit.id ? 'bg-[#ff0000]' : 'bg-[#3d3d3d] hover:bg-[#4d4d4d]'}`}
                style={{
                  left: `${(edit.startTime / project.duration) * 100}%`,
                  width: `${((edit.endTime - edit.startTime) / project.duration) * 100}%`,
                }}
                onClick={() => {
                  setSelectedEditId(edit.id);
                  if (videoRef.current) videoRef.current.currentTime = edit.startTime;
                }}
                title={edit.type === 'text' ? edit.content : edit.description}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: Properties */}
      <div className="w-full lg:w-80 bg-[#212121] rounded-xl shadow-lg border border-[#3d3d3d] flex flex-col overflow-hidden">
        <div className="bg-[#1a1a1a] p-3 border-b border-[#3d3d3d]">
          <h2 className="font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#ff0000]" /> Propriedades
          </h2>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          {selectedEdit ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-[#ff0000]">
                  {selectedEdit.type === 'text' ? 'Editar Texto' : 'Editar Imagem'}
                </h3>
                <button onClick={() => deleteEdit(selectedEdit.id)} className="text-gray-400 hover:text-red-500 p-1" title="Excluir">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Início (s)</label>
                  <input
                    type="number"
                    value={selectedEdit.startTime}
                    onChange={(e) => updateEdit(selectedEdit.id, { startTime: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#0f0f0f] border border-[#3d3d3d] rounded p-1.5 text-sm focus:border-[#ff0000] focus:outline-none"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Fim (s)</label>
                  <input
                    type="number"
                    value={selectedEdit.endTime}
                    onChange={(e) => updateEdit(selectedEdit.id, { endTime: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#0f0f0f] border border-[#3d3d3d] rounded p-1.5 text-sm focus:border-[#ff0000] focus:outline-none"
                    step="0.1"
                  />
                </div>
              </div>

              {selectedEdit.type === 'text' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Texto</label>
                    <input
                      type="text"
                      value={selectedEdit.content || ''}
                      onChange={(e) => updateEdit(selectedEdit.id, { content: e.target.value })}
                      className="w-full bg-[#0f0f0f] border border-[#3d3d3d] rounded p-1.5 text-sm focus:border-[#ff0000] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Tamanho</label>
                      <input
                        type="number"
                        value={selectedEdit.style?.fontSize || 48}
                        onChange={(e) => updateEdit(selectedEdit.id, { style: { ...selectedEdit.style, fontSize: parseInt(e.target.value) || 48 } })}
                        className="w-full bg-[#0f0f0f] border border-[#3d3d3d] rounded p-1.5 text-sm focus:border-[#ff0000] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Cor</label>
                      <input
                        type="color"
                        value={selectedEdit.style?.color || '#ffffff'}
                        onChange={(e) => updateEdit(selectedEdit.id, { style: { ...selectedEdit.style, color: e.target.value } })}
                        className="w-full h-8 bg-[#0f0f0f] border border-[#3d3d3d] rounded cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Borda (px)</label>
                      <input
                        type="number"
                        value={selectedEdit.style?.borderWidth || 2}
                        onChange={(e) => updateEdit(selectedEdit.id, { style: { ...selectedEdit.style, borderWidth: parseInt(e.target.value) || 0 } })}
                        className="w-full bg-[#0f0f0f] border border-[#3d3d3d] rounded p-1.5 text-sm focus:border-[#ff0000] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Cor da Borda</label>
                      <input
                        type="color"
                        value={selectedEdit.style?.borderColor || '#000000'}
                        onChange={(e) => updateEdit(selectedEdit.id, { style: { ...selectedEdit.style, borderColor: e.target.value } })}
                        className="w-full h-8 bg-[#0f0f0f] border border-[#3d3d3d] rounded cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Fonte</label>
                    <select
                      value={selectedEdit.style?.fontFamily || 'Impact'}
                      onChange={(e) => updateEdit(selectedEdit.id, { style: { ...selectedEdit.style, fontFamily: e.target.value } })}
                      className="w-full bg-[#0f0f0f] border border-[#3d3d3d] rounded p-1.5 text-sm focus:border-[#ff0000] focus:outline-none"
                    >
                      <option value="Impact">Impact</option>
                      <option value="Arial">Arial</option>
                      <option value="Comic Sans MS">Comic Sans</option>
                      <option value="Verdana">Verdana</option>
                      <option value="Courier New">Courier New</option>
                    </select>
                  </div>
                </>
              )}

              {selectedEdit.type === 'image' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Substituir Imagem</label>
                  <label className="flex items-center justify-center gap-2 w-full bg-[#3d3d3d] hover:bg-[#4d4d4d] border border-[#4d4d4d] rounded p-2 text-sm cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" /> Escolher Arquivo
                    <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleImageUpload(selectedEdit.id, e)} />
                  </label>
                  {selectedEdit.imageUrl && (
                    <button
                      onClick={() => updateEdit(selectedEdit.id, { imageUrl: undefined })}
                      className="mt-2 w-full text-xs text-red-500 hover:text-red-400"
                    >
                      Remover Imagem
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-300 mb-4 border-b border-[#3d3d3d] pb-2">Ajustes Globais de Vídeo</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Brilho</span>
                      <span>{project.adjustments.brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="0" max="200"
                      value={project.adjustments.brightness}
                      onChange={(e) => updateProject({ adjustments: { ...project.adjustments, brightness: parseInt(e.target.value) } })}
                      className="w-full accent-[#ff0000] h-1.5 bg-[#3d3d3d] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Contraste</span>
                      <span>{project.adjustments.contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="0" max="200"
                      value={project.adjustments.contrast}
                      onChange={(e) => updateProject({ adjustments: { ...project.adjustments, contrast: parseInt(e.target.value) } })}
                      className="w-full accent-[#ff0000] h-1.5 bg-[#3d3d3d] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Saturação</span>
                      <span>{project.adjustments.saturation}%</span>
                    </div>
                    <input
                      type="range"
                      min="0" max="200"
                      value={project.adjustments.saturation}
                      onChange={(e) => updateProject({ adjustments: { ...project.adjustments, saturation: parseInt(e.target.value) } })}
                      className="w-full accent-[#ff0000] h-1.5 bg-[#3d3d3d] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
              <div className="text-center text-sm text-gray-500 pt-4 border-t border-[#3d3d3d]">
                Selecione um elemento no vídeo ou na timeline para editá-lo.
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#3d3d3d] flex gap-2">
          <button onClick={onBack} className="flex-1 px-4 py-2 border border-[#3d3d3d] hover:bg-[#3d3d3d] rounded-md font-medium transition-colors text-sm">
            Voltar
          </button>
          <button onClick={onNext} className="flex-1 bg-[#ff0000] hover:bg-[#cc0000] text-white px-4 py-2 rounded-md font-medium transition-colors text-sm">
            Exportar
          </button>
        </div>
      </div>
    </div>
  );
}
