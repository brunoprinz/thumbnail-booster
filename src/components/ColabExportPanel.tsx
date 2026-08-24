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
# 🚀 THUMBNAIL BOOSTER - PIPELINE COLAB (BLINDADO: PIL + UPLOAD DE IMAGENS + ÁUDIO)
# ==============================================================================

import os
import subprocess
from google.colab import files

print("⚡ [1/5] Instalando dependências (OpenCV, Pillow, Numpy)...")
get_ipython().system('pip install -q opencv-python numpy Pillow')
get_ipython().system('apt-get install -y ffmpeg')

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

EDITS_DATA = ${editsJson}
ADJUSTMENTS = ${adjustments}
INCLUDE_AUDIO = ${includeAudio ? 'True' : 'False'}

input_file = "input_video.mp4"
temp_video = "temp_video.mp4"
final_file = "video_exportado_final.mp4"

if not os.path.exists(input_file):
    print("📤 Por favor, faça upload do seu VÍDEO original de entrada:")
    uploaded = files.upload()
    for filename in uploaded.keys():
        os.rename(filename, input_file)
        break

# Passo de verificação e upload dinâmico de imagens se houver edições do tipo 'image'
image_edits = [e for e in EDITS_DATA if e.get('type') == 'image']
if image_edits:
    print(f"🖼️ Detectada(s) {len(image_edits)} imagem(ns) usada(s) na edição.")
    print("📤 Por favor, faça o upload da(s) imagem(ns) correspondente(s):")
    uploaded_imgs = files.upload()
    # Mapeia os arquivos enviados para o diretório de trabalho local
    for filename in uploaded_imgs.keys():
        print(f"✅ Imagem carregada: {filename}")

print("🎬 [2/5] Processando vídeo com PIL (Suporte a acentos e contornos)...")
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

# Tenta carregar uma fonte padrão do sistema Linux ou usa default
try:
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    if not os.path.exists(font_path):
        font_path = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
except:
    font_path = None

frame_idx = 0
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
        
    current_time = frame_idx / fps
    
    # Ajustes de cor globais via OpenCV
    frame = cv2.convertScaleAbs(frame, alpha=contrast, beta=(brightness - 1) * 50)
    
    # Verifica se há edições ativas neste frame
    active_edits = [e for e in EDITS_DATA if current_time >= e['startTime'] and current_time <= e['endTime']]
    
    if active_edits:
        # Converte o frame do OpenCV (BGR) para PIL (RGB) para desenhar textos e imagens perfeitamente
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(frame_rgb)
        draw = ImageDraw.Draw(pil_img)

        for edit in active_edits:
            if edit['type'] == 'text':
                text = edit.get('content', '')
                x = float(edit['x'])
                y = float(edit['y'])
                style = edit.get('style', {})
                font_size = int(style.get('fontSize', 48))
                
                # Cores
                color_hex = style.get('color', '#ffffff').strip('#')
                text_color = tuple(int(color_hex[i:i+2], 16) for i in (0, 2, 4)) if len(color_hex) == 6 else (255, 255, 255)
                
                border_hex = style.get('borderColor', '#000000').strip('#')
                border_color = tuple(int(border_hex[i:i+2], 16) for i in (0, 2, 4)) if len(border_hex) == 6 else (0, 0, 0)
                border_width = int(style.get('borderWidth', 2))

                try:
                    font = ImageFont.truetype(font_path, font_size) if font_path and os.path.exists(font_path) else ImageFont.load_default()
                except:
                    font = ImageFont.load_default()

                # Desenha o contorno (stroke simulado com offset) e o texto principal (suporta acentos perfeitamente)
                if border_width > 0:
                    for adj_x in range(-border_width, border_width + 1):
                        for adj_y in range(-border_width, border_width + 1):
                            if adj_x != 0 or adj_y != 0:
                                draw.text((x + adj_x, y + adj_y), text, font=font, fill=border_color)
                
                draw.text((x, y), text, font=font, fill=text_color)

            elif edit['type'] == 'image':
                # Procura a imagem carregada pelo usuário no ambiente
                # Como o nome do blob original muda, pegamos qualquer imagem enviada ou tentamos match pelo nome
                uploaded_files = list(uploaded_imgs.keys()) if 'uploaded_imgs' in locals() and uploaded_imgs else []
                if uploaded_files:
                    # Pega o primeiro arquivo enviado como fallback ou tenta associar
                    img_filename = uploaded_files[0] 
                    try:
                        overlay = Image.open(img_filename).convert("RGBA")
                        iw = int(edit.get('width', 200))
                        ih = int(edit.get('height', 200))
                        overlay = overlay.resize((iw, ih))
                        ix = int(edit['x'])
                        iy = int(edit['y'])
                        pil_img.paste(overlay, (ix, iy), overlay)
                    except Exception as e:
                        print(f"Erro ao inserir imagem: {e}")

        # Retorna o frame processado do PIL de volta para o formato do OpenCV (BGR)
        frame = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    out.write(frame)
    frame_idx += 1
    if frame_idx % 60 == 0:
        print(f"Progresso: {int((frame_idx / total_frames) * 100)}%")

cap.release()
out.release()
print("✅ [3/5] Renderização de vídeo concluída!")

if INCLUDE_AUDIO:
    print("🔊 [4/5] Unindo áudio original com FFmpeg...")
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
    print("📁 [4/5] Áudio desativado. Renomeando arquivo final...")
    if os.path.exists(final_file):
        os.remove(final_file)
    os.rename(temp_video, final_file)

print("✅ [5/5] Arquivo pronto para download!")
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
            "Mude o ambiente de execução para **T4 GPU** e execute a célula abaixo!"
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
          <p className="font-bold">Como funciona esta versão blindada:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-300">
            <li>Baixe o Notebook atualizado ou copie o script.</li>
            <li>No Colab, ao rodar, ele detectará se há imagens e pedirá o upload delas automaticamente.</li>
            <li>Os textos agora usam PIL (suporte completo a acentos e contornos perfeitos!).</li>
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
            onClick(handleCopyScript)
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