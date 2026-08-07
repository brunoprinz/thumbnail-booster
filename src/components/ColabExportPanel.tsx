import React, { useState } from 'react';
import { ProjectState } from '../types';
import { Copy, Check, ExternalLink, Sparkles, Download } from 'lucide-react';

interface Props {
  project: ProjectState;
  includeAudio: boolean;
  onBack: () => void;
}

export default function ColabExportPanel({ project, includeAudio, onBack }: Props) {
  const [copied, setCopied] = useState(false);

  const generateColabScript = () => {
    const editsJson = JSON.stringify(project.edits, null, 2);
    const adjustments = JSON.stringify(project.adjustments);

    return `# ==============================================================================
    # 🚀 THUMBNAIL BOOSTER - PIPELINE COLAB (RESOLUÇÃO ORIGINAL + ÁUDIO)
    # ==============================================================================
    
    import os
    import subprocess
    from google.colab import files
    
    print("⚡ [1/4] Instalando dependências...")
    !pip install -q opencv-python numpy
    !apt-get install -y ffmpeg
    
    import cv2
    import numpy as np
    
    # Dados injetados
    EDITS_DATA = ${editsJson}
    ADJUSTMENTS = ${adjustments}
    INCLUDE_AUDIO = ${includeAudio ? 'True' : 'False'}
    
    input_file = "input_video.mp4"
    temp_video = "temp_video.mp4"
    final_file = "video_exportado_final.mp4"
    
    if not os.path.exists(input_file):
        print("📤 Por favor, faça upload do seu vídeo original de entrada:")
        uploaded = files.upload()
        for filename in uploaded.keys():
            os.rename(filename, input_file)
            break
    
    print("🎬 [2/4] Processando vídeo mantendo a resolução original...")
    cap = cv2.VideoCapture(input_file)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(temp_video, fourcc, fps, (width, height))
    
    brightness = ADJUSTMENTS.get('brightness', 100) / 100.0
    contrast = ADJUSTMENTS.get('contrast', 100) / 100.0
    saturation = ADJUSTMENTS.get('saturation', 100) / 100.0
    
    frame_idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        current_time = frame_idx / fps
        
        # Ajustes globais de cor
        frame = cv2.convertScaleAbs(frame, alpha=contrast, beta=(brightness - 1) * 50)
        
        # Renderizar edições
        for edit in EDITS_DATA:
            if current_time >= edit['startTime'] and current_time <= edit['endTime']:
                if edit['type'] == 'text':
                    text = edit.get('content', '')
                    x = int(edit['x'])
                    y = int(edit['y'])
                    style = edit.get('style', {})
                    font_size = int((style.get('fontSize', 48) / 72) * 24)
                    color_hex = style.get('color', '#ffffff').replace('#', '', 1)
                    color_bgr = (int(color_hex[4:6], 16), int(color_hex[2:4], 16), int(color_hex[0:2], 16))
                    
                    cv2.putText(frame, text, (x, y + font_size), cv2.FONT_HERSHEY_SIMPLEX, font_size / 24.0, color_bgr, 2, cv2.LINE_AA)
    
        out.write(frame)
        frame_idx += 1
        if frame_idx % 60 == 0:
            print(f"Progresso: {int((frame_idx / total_frames) * 100)}%")
    
    cap.release()
    out.release()
    print("✅ [3/4] Renderização de vídeo concluída!")
    
    # Tratamento unificado do áudio e arquivo final
    if INCLUDE_AUDIO:
        print("🔊 [3.5/4] Unindo áudio original com FFmpeg...")
        # Usa -y para sobrescrever se já existir e garante o mapeamento correto
        subprocess.run([
            'ffmpeg', '-y', 
            '-i', temp_video, 
            '-i', input_file, 
            '-c:v', 'copy', 
            '-c:a', 'aac', 
            '-map', '0:v:0', 
            '-map', '1:a:0', 
            '-shortest', 
            final_file
        ])
    else:
        print("📁 [3.5/4] Áudio desativado. Renomeando arquivo final...")
        if os.path.exists(final_file):
            os.remove(final_file)
        os.rename(temp_video, final_file)
    
    print("✅ [4/4] Arquivo pronto para download!")
    files.download(final_file)
    `;
    };

  const scriptContent = generateColabScript();

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadNotebook = () => {
    const notebookJson = {
      nbformat: 4,
      nbformat_minor: 0,
      metadata: { colab: { name: "Thumbnail_Booster_Colab.ipynb" }, kernelspec: { display_name: "Python 3", name: "python3" } },
      cells: [
        {
          cell_type: "markdown",
          metadata: {},
          source: [
            "# 🚀 Thumbnail Booster - Pipeline Colab\n",
            "Mude o ambiente de execução para **T4 GPU** (Ambiente de execução -> Alterar tipo de ambiente) e execute a célula abaixo!"
          ]
        },
        {
          cell_type: "code",
          execution_count: null,
          metadata: {},
          outputs: [],
          source: scriptContent.split('\n').map(l => l + '\n')
        }
      ]
    };

    const blob = new Blob([JSON.stringify(notebookJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Thumbnail_Booster_Colab.ipynb';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto mt-8">
      <div className="bg-[#212121] rounded-xl p-8 shadow-lg border border-[#3d3d3d] space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="text-sky-400" /> Exportar via Google Colab (Resolução Original)
          </h2>
          <a
            href="https://colab.research.google.com"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <span>Abrir Colab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-4 text-xs text-sky-200 space-y-2">
          <p className="font-bold">Como funciona esta aba separada:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-300">
            <li>Baixe o arquivo do Notebook ou copie o script Python abaixo.</li>
            <li>Abra o Google Colab, faça o upload do notebook e ative a **T4 GPU**.</li>
            <li>Faça o upload do seu vídeo quando solicitado e baixe o resultado em resolução nativa!</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={onBack}
            className="px-4 py-3 border border-[#3d3d3d] hover:bg-[#3d3d3d] rounded-md font-medium transition-colors text-sm"
          >
            Voltar
          </button>
          
          <button
            onClick={handleCopyScript}
            className="flex-1 bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white px-4 py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Script Copiado!' : 'Copiar Script Python (.py)'}
          </button>

          <button
            onClick={handleDownloadNotebook}
            className="flex-1 bg-sky-600 hover:bg-sky-500 text-white px-4 py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-sky-500/20"
          >
            <Download className="w-4 h-4" /> Baixar Notebook (.ipynb)
          </button>
        </div>

        <div className="relative">
          <div className="text-xs text-gray-400 mb-1 flex justify-between items-center">
            <span>Prévia do Script Gerado:</span>
            <span className="font-mono text-sky-400">{project.edits.length} edições na timeline</span>
          </div>
          <textarea
            readOnly
            value={scriptContent}
            className="w-full h-56 bg-[#0f0f0f] border border-[#3d3d3d] rounded-lg p-4 text-xs font-mono text-gray-300 resize-none focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}