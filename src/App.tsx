/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

 import React, { useState } from 'react';
 import { ProjectState, VideoEdit, VideoAdjustments } from './types';
 import VideoUploader from './components/VideoUploader';
 import GeminiIntegration from './components/GeminiIntegration';
 import VideoEditor from './components/VideoEditor';
 import ExportPanel from './components/ExportPanel';
 import ColabExportPanel from './components/ColabExportPanel';
 
 export default function App() {
   const [project, setProject] = useState<ProjectState>({
     videoFile: null,
     videoUrl: null,
     edits: [],
     adjustments: { brightness: 100, contrast: 100, saturation: 100 },
     duration: 0,
   });
 
   const [currentStep, setCurrentStep] = useState<number>(1);
 
   const handleVideoUpload = (file: File) => {
     const url = URL.createObjectURL(file);
     setProject((prev) => ({ ...prev, videoFile: file, videoUrl: url }));
     setCurrentStep(2);
   };
 
   const handleJsonImport = (edits: VideoEdit[], adjustments?: VideoAdjustments) => {
     setProject((prev) => ({
       ...prev,
       edits,
       adjustments: adjustments || prev.adjustments,
     }));
     setCurrentStep(3);
   };
 
   const updateProject = (updates: Partial<ProjectState>) => {
     setProject((prev) => ({ ...prev, ...updates }));
   };
 
   return (
     <div className="min-h-screen bg-[#0f0f0f] text-white font-sans">
       <header className="bg-[#212121] border-b border-[#3d3d3d] p-4 flex items-center justify-between sticky top-0 z-50">
         <div className="flex items-center gap-3">
           <i className="fa-brands fa-youtube text-[#ff0000] text-3xl"></i>
           <h1 className="text-xl font-semibold tracking-tight">Thumbnail Booster</h1>
         </div>
         <div className="flex gap-2">
           {/* Atualizado para renderizar as 5 etapas no topo */}
           {[1, 2, 3, 4, 5].map((step) => (
             <div
               key={step}
               className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                 currentStep >= step ? 'bg-[#ff0000] text-white' : 'bg-[#3d3d3d] text-gray-400'
               }`}
             >
               {step}
             </div>
           ))}
         </div>
       </header>
 
       <main className="max-w-7xl mx-auto p-6">
         {currentStep === 1 && <VideoUploader onUpload={handleVideoUpload} />}
         {currentStep === 2 && (
           <GeminiIntegration onImport={handleJsonImport} onSkip={() => setCurrentStep(3)} />
         )}
         {currentStep === 3 && (
           <VideoEditor
             project={project}
             updateProject={updateProject}
             onNext={() => setCurrentStep(4)}
             onBack={() => setCurrentStep(2)}
           />
         )}
         {currentStep === 4 && (
           <ExportPanel
             project={project}
             onBack={() => setCurrentStep(3)}
           />
         )}
         {/* Adicionado o passo 5 apontando para o ColabExportPanel */}
         {currentStep === 5 && (
           <ColabExportPanel
             project={project}
             onBack={() => setCurrentStep(4)}
           />
         )}
       </main>
     </div>
   );
 }