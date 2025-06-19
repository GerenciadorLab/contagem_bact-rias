let cvReady = false;
let srcMat = null;
let originalImage = null;

// Callback quando OpenCV.js estiver carregado
function onOpenCvReady() {
    cvReady = true;
    console.log('OpenCV.js está pronto');
    document.getElementById('processBtn').disabled = false;
}

// Inicialização
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
        dropZone.style.backgroundColor = '#f0f8ff';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.backgroundColor = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = '';
        if (e.dataTransfer.files.length) {
            imageInput.files = e.dataTransfer.files;
            handleImageUpload();
        }
    });

    // Processar imagem
    processBtn.addEventListener('click', processImage);

    // Resetar
    resetBtn.addEventListener('click', resetAll);

    function handleImageUpload() {
        if (imageInput.files && imageInput.files[0]) {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                originalImage = new Image();
                originalImage.onload = () => {
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
                };
                originalImage.src = e.target.result;
            };
            reader.readAsDataURL(imageInput.files[0]);
        }
    }

    function processImage() {
        if (!cvReady || !srcMat) {
            alert('OpenCV não está pronto ou nenhuma imagem foi carregada');
            return;
        }

        try {
            const minSize = parseInt(minSizeSlider.value);
            const thresholdValue = parseInt(thresholdSlider.value);
            
            // Converte para escala de cinza
            let gray = new cv.Mat();
            cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
            
            // Aplica blur
            let blurred = new cv.Mat();
            cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
            
            // Threshold
            let thresholded = new cv.Mat();
            cv.threshold(blurred, thresholded, thresholdValue, 255, cv.THRESH_BINARY_INV);
            
            // Encontra contornos
            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(thresholded, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            // Filtra contornos por tamanho
            let colonies = [];
            for (let i = 0; i < contours.size(); ++i) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);
                if (area > minSize) {
                    colonies.push(contour);
                }
            }
            
            // Desenha os contornos na imagem original
            let result = srcMat.clone();
            for (let i = 0; i < colonies.length; i++) {
                const color = new cv.Scalar(0, 255, 0, 255); // Verde
                cv.drawContours(result, colonies, i, color, 2, cv.LINE_8, hierarchy, 0);
            }
            
            // Exibe o resultado
            cv.imshow(processedCanvas, result);
            resultSpan.textContent = colonies.length;
            
            // Libera memória
            gray.delete();
            blurred.delete();
            thresholded.delete();
            contours.delete();
            hierarchy.delete();
            result.delete();
            
        } catch (err) {
            console.error(err);
            alert('Ocorreu um erro ao processar a imagem');
        }
    }

    function resetAll() {
        originalCanvas.getContext('2d').clearRect(0, 0, originalCanvas.width, originalCanvas.height);
        processedCanvas.getContext('2d').clearRect(0, 0, processedCanvas.width, processedCanvas.height);
        resultSpan.textContent = '0';
        imageInput.value = '';
        if (srcMat) {
            srcMat.delete();
            srcMat = null;
        }
    }
});