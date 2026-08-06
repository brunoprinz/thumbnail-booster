import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, VideoEdit } from '../types';
import * as Mp4Muxer from 'mp4-muxer';
import { Download, AlertTriangle, Settings2, Music, Film, Layers, Sparkles } from 'lucide-react';

// Declarações para evitar erros de TypeScript com WebCodecs
declare var AudioEncoder: any;
declare var AudioData: any;

interface Props {
  project: ProjectState;
  onBack: () => void;
  onGoToStep: (step: number) => void; // Adicione esta linha
}

export default function ExportPanel({ project, onBack }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Configurações de Exportação
  const [resolution, setResolution] = useState<'original' | '720' | '480'>('original');
  const [exportMode, setExportMode] = useState<'full' | 'batch'>('full');
  const [batchPart, setBatchPart] = useState<number>(0);
  const [includeAudio, setIncludeAudio] = useState<boolean>(false);

  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});

  const CHUNK_SIZE = 60; // 60 segundos por lote
  const numChunks = Math.ceil((project.duration || 1) / CHUNK_SIZE);
  const chunks = Array.from({ length: numChunks }, (_, i) => ({
    index: i,
    start: i * CHUNK_SIZE,
    end: Math.min((i + 1) * CHUNK_SIZE, project.duration || 1)
  }));

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const loadImages = async () => {
      const images: Record<string, HTMLImageElement> = {};
      for (const edit of project.edits) {
        if (edit.type === 'image' && edit.imageUrl) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            img.src = edit.imageUrl!;
          });
          images[edit.id] = img;
        }
      }
      setLoadedImages(images);
    };
    loadImages();
  }, [project.edits]);

  const exportAudioOnly = async () => {
    if (!project.videoFile) return;
    
    setIsExporting(true);
    setStatus('Extraindo áudio do vídeo...');
    setProgress(0);
    setError(null);

    try {
      const arrayBuffer = await project.videoFile.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      setStatus('Convertendo para WAV...');
      setProgress(50);

      const numOfChan = audioBuffer.numberOfChannels;
      const length = audioBuffer.length * numOfChan * 2 + 44;
      const buffer = new ArrayBuffer(length);
      const view = new DataView(buffer);
      let offset = 0;

      const writeString = (str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
        offset += str.length;
      };

      writeString('RIFF');
      view.setUint32(offset, length - 8, true); offset += 4;
      writeString('WAVE');
      writeString('fmt ');
      view.setUint32(offset, 16, true); offset += 4;
      view.setUint16(offset, 1, true); offset += 2;
      view.setUint16(offset, numOfChan, true); offset += 2;
      view.setUint32(offset, audioBuffer.sampleRate, true); offset += 4;
      view.setUint32(offset, audioBuffer.sampleRate * 2 * numOfChan, true); offset += 4;
      view.setUint16(offset, numOfChan * 2, true); offset += 2;
      view.setUint16(offset, 16, true); offset += 2;
      writeString('data');
      view.setUint32(offset, length - offset - 4, true); offset += 4;

      for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numOfChan; channel++) {
          let sample = audioBuffer.getChannelData(channel)[i];
          sample = Math.max(-1, Math.min(1, sample));
          sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          view.setInt16(offset, sample, true);
          offset += 2;
        }
      }

      const blob = new Blob([view], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audio_extraido.wav';
      a.click();
      URL.revokeObjectURL(url);
      
      setStatus('Áudio exportado com sucesso!');
      setProgress(100);
      setTimeout(() => setIsExporting(false), 2000);

    } catch (err: any) {
      setError('Erro ao extrair áudio: ' + (err.message || 'Desconhecido'));
      setIsExporting(false);
    }
  };

  const startExport = async () => {
    if (!project.videoFile) return;
    
    setIsExporting(true);
    setProgress(0);
    setStatus('Preparando...');
    setError(null);
    setDownloadUrl(null);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const startTime = exportMode === 'batch' ? chunks[batchPart].start : 0;
      const endTime = exportMode === 'batch' ? chunks[batchPart].end : project.duration;

      const video = document.createElement('video');
      video.src = URL.createObjectURL(project.videoFile);
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      // Calcular resolução
      let targetWidth = video.videoWidth;
      let targetHeight = video.videoHeight;

      if (resolution === '720' && targetHeight > 720) {
        targetWidth = Math.round((720 / targetHeight) * targetWidth);
        targetHeight = 720;
      } else if (resolution === '480' && targetHeight > 480) {
        targetWidth = Math.round((480 / targetHeight) * targetWidth);
        targetHeight = 480;
      }

      // H.264 requires even dimensions
      const width = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
      const height = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;
      
      const fps = 30;
      const startFrame = Math.floor(startTime * fps);
      const endFrame = Math.floor(endTime * fps);
      const totalFrames = endFrame - startFrame;

      // Processar Áudio se solicitado
      let audioBuffer: AudioBuffer | null = null;
      if (includeAudio) {
        setStatus('Decodificando áudio (isso pode demorar e consumir RAM)...');
        try {
          const arrayBuffer = await project.videoFile.arrayBuffer();
          const audioCtx = new AudioContext();
          audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
          console.warn('Falha ao decodificar áudio, exportando sem áudio.', e);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Could not get canvas context');

      const muxerOptions: any = {
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width,
          height,
        },
        fastStart: 'in-memory',
      };

      if (includeAudio && audioBuffer) {
        muxerOptions.audio = {
          codec: 'aac',
          numberOfChannels: audioBuffer.numberOfChannels,
          sampleRate: audioBuffer.sampleRate,
        };
      }

      const muxer = new Mp4Muxer.Muxer(muxerOptions);

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta as any),
        error: (e) => {
          console.error(e);
          setError('Erro no encoder de vídeo: ' + e.message);
        },
      });

      videoEncoder.configure({
        codec: 'avc1.42001f',
        width,
        height,
        bitrate: resolution === '480' ? 2_000_000 : resolution === '720' ? 3_500_000 : 5_000_000,
        framerate: fps,
      });

      let audioEncoder: any = null;
      if (includeAudio && audioBuffer) {
        audioEncoder = new AudioEncoder({
          output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
          error: (e: any) => console.error('AudioEncoder error', e)
        });
        audioEncoder.configure({
          codec: 'mp4a.40.2',
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
          bitrate: 128000
        });
      }

      setStatus(`Processando vídeo (${exportMode === 'batch' ? 'Parte ' + (batchPart + 1) : 'Completo'})...`);
      
      let lastTime = -1;

      for (let frameIndex = startFrame; frameIndex < endFrame; frameIndex++) {
        if (signal.aborted) throw new Error('Exportação cancelada');

        const currentTime = frameIndex / fps;
        
        if (currentTime !== lastTime) {
          video.currentTime = currentTime;
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
            };
            video.addEventListener('seeked', onSeeked);
            setTimeout(() => {
              video.removeEventListener('seeked', onSeeked);
              resolve();
            }, 500);
          });
          lastTime = currentTime;
        }

        ctx.filter = `brightness(${project.adjustments.brightness}%) contrast(${project.adjustments.contrast}%) saturate(${project.adjustments.saturation}%)`;
        ctx.drawImage(video, 0, 0, width, height);
        ctx.filter = 'none';

        const activeEdits = project.edits.filter(
          (e) => currentTime >= e.startTime && currentTime <= e.endTime
        );

        for (const edit of activeEdits) {
          // Escalar posições e tamanhos baseados na resolução original vs exportada
          const scaleX = width / video.videoWidth;
          const scaleY = height / video.videoHeight;

          if (edit.type === 'text' && edit.content) {
            const fontSize = (edit.style?.fontSize || 48) * scaleY;
            ctx.font = `${fontSize}px ${edit.style?.fontFamily || 'Impact'}`;
            ctx.fillStyle = edit.style?.color || '#ffffff';
            ctx.strokeStyle = edit.style?.borderColor || '#000000';
            ctx.lineWidth = (edit.style?.borderWidth || 2) * scaleY;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            if (ctx.lineWidth > 0) {
              ctx.strokeText(edit.content, edit.x * scaleX, edit.y * scaleY);
            }
            ctx.fillText(edit.content, edit.x * scaleX, edit.y * scaleY);
          } else if (edit.type === 'image' && loadedImages[edit.id]) {
            const img = loadedImages[edit.id];
            ctx.drawImage(img, edit.x * scaleX, edit.y * scaleY, (edit.width || 200) * scaleX, (edit.height || 200) * scaleY);
          }
        }

        // Timestamp relativo ao início do lote para que o vídeo comece em 0
        const timestamp = ((frameIndex - startFrame) * 1e6) / fps;
        const frame = new VideoFrame(canvas, { timestamp });
        videoEncoder.encode(frame, { keyFrame: (frameIndex - startFrame) % 30 === 0 });
        frame.close();

        if ((frameIndex - startFrame) % 15 === 0) {
          setProgress(Math.round(((frameIndex - startFrame) / totalFrames) * (includeAudio ? 50 : 100)));
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      await videoEncoder.flush();

      // Processar Áudio se necessário
      if (includeAudio && audioBuffer && audioEncoder) {
        setStatus('Codificando áudio...');
        const sampleRate = audioBuffer.sampleRate;
        const numberOfChannels = audioBuffer.numberOfChannels;
        
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const samplesToProcess = endSample - startSample;
        
        const frameSize = 1024;
        for (let i = 0; i < samplesToProcess; i += frameSize) {
          if (signal.aborted) throw new Error('Exportação cancelada');
          const frames = Math.min(frameSize, samplesToProcess - i);
          const timestamp = (i / sampleRate) * 1e6;
          
          const planarData = new Float32Array(frames * numberOfChannels);
          for (let c = 0; c < numberOfChannels; c++) {
            const channelData = audioBuffer.getChannelData(c);
            planarData.set(channelData.subarray(startSample + i, startSample + i + frames), c * frames);
          }
          
          const audioData = new AudioData({
            format: 'f32-planar',
            sampleRate,
            numberOfFrames: frames,
            numberOfChannels,
            timestamp,
            data: planarData
          });
          
          audioEncoder.encode(audioData);
          audioData.close();
          
          if (i % (frameSize * 100) === 0) {
            setProgress(50 + Math.round((i / samplesToProcess) * 50));
            await new Promise(r => setTimeout(r, 0));
          }
        }
        await audioEncoder.flush();
      }

      setStatus('Finalizando arquivo MP4...');
      muxer.finalize();

      const buffer = muxer.target.buffer;
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      setDownloadUrl(url);
      setStatus('Concluído!');
      setProgress(100);

    } catch (err: any) {
      if (err.message !== 'Exportação cancelada') {
        setError(err.message || 'Erro desconhecido durante a exportação.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const cancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-8">
      <div className="bg-[#212121] rounded-xl p-8 shadow-lg border border-[#3d3d3d]">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Download className="text-[#ff0000]" /> Exportar Vídeo
        </h2>

        {!isExporting && !downloadUrl && (
          <div className="space-y-6 mb-8">
            {/* Configurações de Exportação */}
            <div className="grid md:grid-cols-2 gap-6 bg-[#1a1a1a] p-6 rounded-lg border border-[#3d3d3d]">
              
              {/* Resolução */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Film className="w-4 h-4 text-[#ff0000]" /> Resolução
                </label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                  className="w-full bg-[#0f0f0f] border border-[#3d3d3d] rounded-md p-2.5 text-sm text-white focus:border-[#ff0000] focus:outline-none"
                >
                  <option value="original">Original (Recomendado)</option>
                  <option value="720">720p (Mais rápido)</option>
                  <option value="480">480p (Para PCs muito fracos)</option>
                </select>
              </div>

              {/* Modo de Exportação */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Layers className="w-4 h-4 text-[#ff0000]" /> Modo de Renderização
                </label>
                <select
                  value={exportMode}
                  onChange={(e) => setExportMode(e.target.value as any)}
                  className="w-full bg-[#0f0f0f] border border-[#3d3d3d] rounded-md p-2.5 text-sm text-white focus:border-[#ff0000] focus:outline-none"
                >
                  <option value="full">Vídeo Completo</option>
                  <option value="batch">Em Lotes (Partes de 1 min)</option>
                </select>
              </div>

              {/* Seleção de Lote */}
              {exportMode === 'batch' && (
                <div className="space-y-2 md:col-span-2 bg-[#0f0f0f] p-4 rounded-md border border-[#3d3d3d]">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Selecione a parte para renderizar:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {chunks.map((chunk) => (
                      <button
                        key={chunk.index}
                        onClick={() => setBatchPart(chunk.index)}
                        className={`p-2 text-sm rounded border transition-colors ${
                          batchPart === chunk.index
                            ? 'bg-[#ff0000]/20 border-[#ff0000] text-[#ff0000]'
                            : 'bg-[#212121] border-[#3d3d3d] text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        Parte {chunk.index + 1} <br/>
                        <span className="text-xs opacity-70">({formatTime(chunk.start)} - {formatTime(chunk.end)})</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Renderizar em partes evita travamentos em PCs com pouca memória. Você pode juntar as partes depois.
                  </p>
                </div>
              )}

              {/* Áudio */}
              <div className="space-y-3 md:col-span-2 pt-4 border-t border-[#3d3d3d]">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={includeAudio}
                      onChange={(e) => setIncludeAudio(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${includeAudio ? 'bg-[#ff0000]' : 'bg-[#3d3d3d]'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${includeAudio ? 'translate-x-4' : 'translate-x-0'}`}></div>
                  </div>
                  <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                    Incluir Áudio no MP4 Exportado
                  </span>
                </label>
                
                {includeAudio && (
                  <div className="flex items-start gap-2 text-yellow-500 bg-yellow-500/10 p-3 rounded-md border border-yellow-500/20">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="text-xs">
                      <strong>Atenção:</strong> Processar áudio consome bastante memória RAM. Se o seu navegador travar (especialmente em PCs com 4GB), desmarque esta opção e exporte o áudio separadamente.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

{!isExporting && !downloadUrl && (
          <div className="space-y-4">
            {/* Bloco principal de botões de ação local */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={onBack}
                className="px-4 py-3 border border-[#3d3d3d] hover:bg-[#3d3d3d] rounded-md font-medium transition-colors text-center"
              >
                Voltar
              </button>
              <button
                onClick={exportAudioOnly}
                className="flex-1 px-4 py-3 bg-[#3d3d3d] hover:bg-[#4d4d4d] rounded-md font-medium transition-colors flex items-center justify-center gap-2"
                title="Extrai o áudio original em formato WAV para você juntar depois"
              >
                <Music className="w-5 h-5" /> Exportar Somente Áudio (WAV)
              </button>
              <button
                onClick={startExport}
                className="flex-1 bg-[#ff0000] hover:bg-[#cc0000] text-white px-4 py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" /> Iniciar Exportação (Local)
              </button>
            </div>

            {/* 🔥 NOVO BOTÃO: Atalho direto para o Google Colab */}
            <button
              onClick={() => onGoToStep(5)}
              className="w-full py-3 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 rounded-md font-medium transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>Ou Processar via Google Colab (Resolução Original / Sem Travamentos)</span>
            </button>
          </div>
        )}

        {isExporting && (
          <div className="space-y-4">
            <div className="flex justify-between text-sm font-medium text-gray-300">
              <span>{status}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-[#0f0f0f] rounded-full h-3 overflow-hidden">
              <div
                className="bg-[#ff0000] h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <button
              onClick={cancelExport}
              className="w-full mt-4 px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 rounded-md font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm">
            {error}
          </div>
        )}

        {downloadUrl && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
              <Download className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                {exportMode === 'batch' ? `Parte ${batchPart + 1} Pronta!` : 'Vídeo Pronto!'}
              </h3>
              <p className="text-gray-400 text-sm">O processamento foi concluído com sucesso.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => {
                  setDownloadUrl(null);
                  setProgress(0);
                }}
                className="flex-1 px-4 py-3 border border-[#3d3d3d] hover:bg-[#3d3d3d] rounded-md font-medium transition-colors"
              >
                {exportMode === 'batch' ? 'Exportar Outra Parte' : 'Fazer Nova Exportação'}
              </button>
              <a
                href={downloadUrl}
                download={`video_thumbnail_booster${exportMode === 'batch' ? '_parte_' + (batchPart + 1) : ''}.mp4`}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" /> Baixar MP4
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}