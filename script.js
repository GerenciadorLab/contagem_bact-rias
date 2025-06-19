let cvReady = false;
let srcMat = null;
let originalImage = null;

// Mostra mensagem de erro formatada
function showError(message, details = '') {
    const errorBox = document.getElementById('errorBox');
    errorBox.innerHTML = `
        <strong>Erro:</strong> ${message}
        ${details ? `<details><summary>Detalhes</summary><pre>${details}</pre></details>` : ''}
    `;
    errorBox.style.display = 'block';
    console.error(message, details);
}

// Esconde mensagens de erro
function hideError() {
    document.getElementById('errorBox').style.display = 'none';
}

// Callback quando OpenCV.js estiver carregado
function onOpenCvReady() {
    try {
        if (!window.cv) {
            throw new Error('OpenCV.js não foi carregado corretamente');
        }
        
        // Verifica funções essenciais
        if (typeof cv.Mat === 'undefined' || typeof cv.imread === 'undefined') {
            throw new Error('A API do OpenCV não está disponível corretamente');
        }
        
        cvReady = true;
        document.getElementById('processBtn').disabled = false;
        console.log('OpenCV.js está pronto e funcional');
        
    } catch (err) {
        showError('Falha ao inicializar OpenCV', err.stack);
    }
}

// Redimensiona imagem mantendo aspect ratio
function resizeImage(image, maxWidth, maxHeight) {
    const canvas = document.createElement('canvas');
    let width = image.width;
    let height = image.height;

    if (width > height) {
        if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
        }
    } else {
        if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
        }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);
    
    const resizedImage = new Image();
    resizedImage.src = canvas.toDataURL('image/jpeg');
    return resizedImage;
}

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageInput');
    const processBtn = document.getElementById('processBtn');
    const resetBtn = document.getElementById('resetBtn');
    const dropZone = document.getElementById('dropZone');
    const originalCanvas = document.getElementById('originalCanvas');
    const processedCanvas = document.getElementById('processedCanvas');
    const minSizeSlider = document.getElementById('minSize');
    const thresholdSlider = document.getElementById('threshold');
    const minSizeValue = document.getElementById('minSizeValue');
    const thresholdValue = document.getElementById('thresholdValue');
    const resultSpan = document.querySelector('#result span');
    const loadingElement = document.getElementById('loading');

    // Atualiza valores dos sliders
    minSizeSlider.addEventListener('input', () => {
        minSizeValue.textContent = minSizeSlider.value;
    });

    thresholdSlider.addEventListener('input', () => {
        thresholdValue.textContent = thresholdSlider.value;
    });

    // Upload de imagem
    imageInput.addEventListener('change', handleImageUpload);
    
    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            imageInput.files = e.dataTransfer.files;
            handleImageUpload();
        }
    });

    // Processar imagem
    processBtn.addEventListener('click', async () => {
        try {
            hideError();
            loadingElement.style.display = 'block';
            processBtn.disabled = true;
            
            // Adiciona pequeno delay para garantir que a UI atualize
            await new Promise(resolve => setTimeout(resolve, 50));
            
            await processImage();
            
        } catch (err) {
            showError('Erro durante o processamento', err.stack);
        } finally {
            loadingElement.style.display = 'none';
            processBtn.disabled = false;
        }
    });

    // Resetar
    resetBtn.addEventListener('click', resetAll);

    async function handleImageUpload() {
        try {
            hideError();
            
            if (!imageInput.files || !imageInput.files[0]) {
                throw new Error('Nenhum arquivo selecionado');
            }
            
            const file = imageInput.files[0];
            
            // Verificação do tipo de arquivo
            if (!file.type.match('image.*')) {
                throw new Error('Tipo de arquivo não suportado. Use imagens JPG ou PNG.');
            }
            
            // Verificação do tamanho do arquivo (opcional)
            if (file.size > 5 * 1024 * 1024) { // 5MB
                throw new Error('Imagem muito grande (máx. 5MB)');
            }
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
                originalImage = new Image();
                originalImage.onload = () => {
                    // Redimensiona se for muito grande
                    if (originalImage.width > 2000 || originalImage.height > 2000) {
                        originalImage = resizeImage(originalImage, 2000, 2000);
                    }
                    
                    // Exibe a imagem original
                    originalCanvas.width = originalImage.width;
                    originalCanvas.height = originalImage.height;
                    const ctx = originalCanvas.getContext('2d');
                    ctx.drawImage(originalImage, 0, 0);
                    
                    // Prepara o canvas processado
                    processedCanvas.width = originalImage.width;
                    processedCanvas.height = originalImage.height;
                    
                    // Converte para Mat do OpenCV
                    srcMat = cv.imread(originalImage);
                    
                    // Habilita o botão de processar
                    processBtn.disabled = false;
                };
                originalImage.onerror = () => {
                    throw new Error('Falha ao carregar a imagem');
                };
                originalImage.src = e.target.result;
            };
            
            reader.onerror = () => {
                throw new Error('Erro ao ler o arquivo');
            };
            
            reader.readAsDataURL(file);
            
        } catch (err) {
            showError(err.message);
            resetAll();
        }
    }

    async function processImage() {
        if (!window.cv) {
            throw new Error('A biblioteca OpenCV ainda não está pronta. Por favor, aguarde...');
        }
        
        if (!srcMat || srcMat.empty()) {
            throw new Error('Nenhuma imagem válida foi carregada');
        }

        try {
            const minSize = parseInt(minSizeSlider.value);
            const thresholdValue = parseInt(thresholdSlider.value);
            
            console.log('Iniciando processamento com parâmetros:', { minSize, thresholdValue });
            console.log('Memória OpenCV antes:', cv.getTotalMemory());
            
            // Cria cópia da imagem original para trabalhar
            let workingMat = srcMat.clone();
            
            // Converte para escala de cinza
            let gray = new cv.Mat();
            cv.cvtColor(workingMat, gray, cv.COLOR_RGBA2GRAY);
            
            // Aplica blur
            let blurred = new cv.Mat();
            cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
            
            // Threshold - agora com controle manual
            let thresholded = new cv.Mat();
            cv.threshold(blurred, thresholded, thresholdValue, 255, cv.THRESH_BINARY_INV);
            
            // Encontra contornos
            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(thresholded, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            // Filtra contornos por tamanho e forma
            let colonies = [];
            for (let i = 0; i < contours.size(); ++i) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);
                
                // Filtro adicional por circularidade
                const perimeter = cv.arcLength(contour, true);
                const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
                
                if (area > minSize && circularity > 0.3) {
                    colonies.push(contour);
                }
            }
            
            // Desenha os contornos na imagem original
            let result = srcMat.clone();
            const colonyCount = colonies.length;
            const color = new cv.Scalar(0, 255, 0, 255); // Verde
            
            for (let i = 0; i < colonyCount; i++) {
                cv.drawContours(result, colonies, i, color, 2, cv.LINE_8, hierarchy, 0);
                
                // Opcional: Desenha número da colônia
                if (colonyCount < 100) { // Não desenha números se houver muitas colônias
                    const M = cv.moments(colonies[i]);
                    if (M.m00 > 0) {
                        const cX = Math.floor(M.m10 / M.m00);
                        const cY = Math.floor(M.m01 / M.m00);
                        cv.putText(
                            result, 
                            (i+1).toString(), 
                            new cv.Point(cX-5, cY+5), 
                            cv.FONT_HERSHEY_SIMPLEX, 
                            0.5, 
                            new cv.Scalar(255, 0, 0, 255), 
                            1
                        );
                    }
                }
            }
            
            // Exibe o resultado
            cv.imshow(processedCanvas, result);
            resultSpan.textContent = colonyCount;
            
            // Libera memória
            [gray, blurred, thresholded, contours, hierarchy, workingMat, result].forEach(m => {
                try {
                    if (m && !m.isDeleted) m.delete();
                } catch (e) {
                    console.warn('Erro ao liberar memória:', e);
                }
            });
            
            console.log('Processamento concluído. Colônias encontradas:', colonyCount);
            console.log('Memória OpenCV depois:', cv.getTotalMemory());
            
        } catch (err) {
            console.error('Erro no processamento:', {
                error: err,
                stack: err.stack
            });
            
            throw new Error(`Erro ao processar imagem: ${err.message}`);
        }
    }

    function resetAll() {
        try {
            const originalCtx = originalCanvas.getContext('2d');
            const processedCtx = processedCanvas.getContext('2d');
            
            originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
            processedCtx.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
            
            originalCanvas.width = 0;
            originalCanvas.height = 0;
            processedCanvas.width = 0;
            processedCanvas.height = 0;
            
            resultSpan.textContent = '0';
            imageInput.value = '';
            
            if (srcMat && !srcMat.isDeleted) {
                srcMat.delete();
            }
            srcMat = null;
            originalImage = null;
            
            hideError();
            
        } catch (err) {
            console.error('Erro ao resetar:', err);
        }
    }
});