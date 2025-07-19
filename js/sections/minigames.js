// js/sections/minigames.js

export function initialize() {
    if (document.body.dataset.minigamesInitialized === 'true') {
        return;
    }
    document.body.dataset.minigamesInitialized = 'true';
    console.log("Minigames section initializing...");

    let currentQuiz = {
        type: null, card: null, hintIndex: 0, attemptCount: 0,
        quizCanvas: null, quizCtx: null, fullCardImage: null, originalImageData: null,
        transparentCardImage: null // ★追加: 透明画像用のプロパティ
    };

    const quizCardNameButton = document.getElementById('quiz-card-name');
    const quizIllustrationEnlargeButton = document.getElementById('quiz-illustration-enlarge');
    const quizIllustrationSilhouetteButton = document.getElementById('quiz-illustration-silhouette');
    const quizIllustrationMosaicButton = document.getElementById('quiz-illustration-mosaic');
    const quizDisplayArea = document.getElementById('quiz-display-area');
    const quizTitle = document.getElementById('quiz-title');
    const quizHintArea = document.getElementById('quiz-hint-area');
    const quizImageArea = document.getElementById('quiz-image-area');
    const quizCanvas = document.getElementById('quiz-canvas');
    const quizAnswerInput = document.getElementById('quiz-answer-input');
    const quizSubmitButton = document.getElementById('quiz-submit-button');
    const quizResultArea = document.getElementById('quiz-result-area');
    const quizAnswerDisplay = document.getElementById('quiz-answer-display');
    const quizNextButton = document.getElementById('quiz-next-button');
    const quizResetButton = document.getElementById('quiz-reset-button');

    if (!quizCardNameButton || !quizDisplayArea || !quizCanvas || !quizResetButton) {
        console.error("Minigames section is missing required elements.");
        return;
    }

    if (quizCanvas) {
        currentQuiz.quizCanvas = quizCanvas;
        currentQuiz.quizCtx = quizCanvas.getContext('2d');
    }

    function resetQuiz() {
        currentQuiz = {
            ...currentQuiz,
            type: null,
            card: null,
            hintIndex: 0,
            attemptCount: 0,
            fullCardImage: null,
            originalImageData: null,
            transparentCardImage: null // ★追加: 透明画像プロパティのリセット
        };
        quizDisplayArea.style.display = 'none';
        quizTitle.textContent = '';
        quizHintArea.innerHTML = '';
        quizImageArea.style.display = 'none';
        quizCanvas.style.display = 'none';
        quizAnswerInput.value = '';
        quizResultArea.textContent = '';
        quizResultArea.className = 'quiz-result-area';
        quizAnswerDisplay.textContent = '';
        quizNextButton.style.display = 'none';
        quizSubmitButton.style.display = 'inline-block';
        quizAnswerInput.disabled = false;
    }

    async function startQuiz(type) {
        // window.tcgAssistant は main.js で定義されているものと仮定
        if (!window.tcgAssistant.allCards || window.tcgAssistant.allCards.length === 0) {
            await window.showCustomDialog('エラー', 'カードデータがロードされていません。');
            return;
        }
        resetQuiz();
        currentQuiz.type = type;
        currentQuiz.card = window.tcgAssistant.allCards[Math.floor(Math.random() * window.tcgAssistant.allCards.length)];
        quizDisplayArea.style.display = 'block';
        quizTitle.textContent = getQuizTitle(type);

        if (type === 'cardName') {
            displayCardNameQuizHint();
        } else {
            quizImageArea.style.display = 'flex';
            quizCanvas.style.display = 'block';
            try {
                // 日本語のカード名を使用して画像読み込みロジックを直接呼び出す
                await loadImageForQuiz(currentQuiz.card.name);
                drawQuizImage();
            } catch (error) {
                await window.showCustomDialog('エラー', `クイズ画像の読み込みに失敗しました: ${currentQuiz.card.name}`);
                resetQuiz();
            }
        }
    }

    function getQuizTitle(type) {
        const titles = {
            cardName: 'カード名当てクイズ', enlarge: 'イラスト拡大クイズ',
            silhouette: 'イラストシルエットクイズ', mosaic: 'イラストモザイク化クイズ'
        };
        return titles[type] || 'ミニゲーム';
    }

    function displayCardNameQuizHint() {
        if (!currentQuiz.card) return;
        let hintsToShow = currentQuiz.card.info.slice(0, currentQuiz.hintIndex + 1);
        quizHintArea.innerHTML = hintsToShow.join('<br>');
        currentQuiz.hintIndex++;
        if (currentQuiz.hintIndex >= currentQuiz.card.info.length) {
            quizHintArea.innerHTML += '<br><br>これ以上ヒントはありません。';
            endQuiz(false); // ヒントが尽きたら不正解として終了
        }
    }

    // 画像取得ロジックをWeb互換に修正し、日本語カード名を使用
    async function loadImageForQuiz(cardName) { // cardName に変更
        const loadImage = (url) => new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(new Error(`Failed to load image: ${url}. Error: ${err.message}`));
            img.src = url;
        });

        const imageBaseUrl = 'https://omezi42.github.io/tcg-assistant-images/cards/'; // GitHub Pages のURL
        const MAX_RETRIES = 3;

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                // 通常のカード画像をロード (日本語カード名を使用)
                const fullImageUrl = `${imageBaseUrl}${encodeURIComponent(cardName)}.png`;
                currentQuiz.fullCardImage = await loadImage(fullImageUrl);

                // シルエットクイズの場合のみ、透明画像をロード (日本語カード名を使用)
                if (currentQuiz.type === 'silhouette') {
                    const transparentImageUrl = `${imageBaseUrl}${encodeURIComponent(cardName)}_transparent.png`;
                    currentQuiz.transparentCardImage = await loadImage(transparentImageUrl);
                }

                // キャンバスの描画バッファサイズを、表示サイズに合わせる
                if (quizCanvas && currentQuiz.fullCardImage) {
                    const img = currentQuiz.fullCardImage;
                    const parentWidth = quizImageArea.offsetWidth;
                    const parentHeight = quizImageArea.offsetHeight;

                    let targetWidth, targetHeight;

                    if (currentQuiz.type === 'silhouette') {
                        const CROP_X1 = 20;
                        const CROP_Y1 = 90;
                        const CROP_X2 = 457;
                        const CROP_Y2 = 310;
                        const CROP_WIDTH = CROP_X2 - CROP_X1;
                        const CROP_HEIGHT = CROP_Y2 - CROP_Y1;
                        const croppedAspectRatio = CROP_WIDTH / CROP_HEIGHT;
                        const parentAspectRatio = parentWidth / parentHeight;

                        if (croppedAspectRatio > parentAspectRatio) {
                            targetWidth = parentWidth;
                            targetHeight = parentWidth / croppedAspectRatio;
                        } else {
                            targetHeight = parentHeight;
                            targetWidth = parentHeight * croppedAspectRatio;
                        }
                    } else {
                        const imgAspectRatio = img.naturalWidth / img.naturalHeight;
                        const parentAspectRatio = parentWidth / parentHeight;

                        if (imgAspectRatio > parentAspectRatio) {
                            targetWidth = parentWidth;
                            targetHeight = parentWidth / imgAspectRatio;
                        } else {
                            targetHeight = parentHeight;
                            targetWidth = parentHeight * imgAspectRatio;
                        }
                    }

                    quizCanvas.width = targetWidth;
                    quizCanvas.height = targetHeight;

                    const tempOriginalCanvas = document.createElement('canvas');
                    tempOriginalCanvas.width = currentQuiz.fullCardImage.naturalWidth;
                    tempOriginalCanvas.height = currentQuiz.fullCardImage.naturalHeight;
                    const tempOriginalCtx = tempOriginalCanvas.getContext('2d');
                    tempOriginalCtx.drawImage(currentQuiz.fullCardImage, 0, 0);
                    currentQuiz.originalImageData = tempOriginalCtx.getImageData(0, 0, tempOriginalCanvas.width, tempOriginalCanvas.height);
                }
                return;
            } catch (error) {
                if (i < MAX_RETRIES - 1) {
                    console.warn(`Attempt ${i + 1} failed to load image. Retrying...`, error);
                    await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
                    continue;
                }
                console.error("Error in loadImageForQuiz after all retries:", error);
                throw error;
            }
        }
    }

    function drawQuizImage() {
        if (!currentQuiz.quizCtx || !currentQuiz.quizCanvas || !currentQuiz.fullCardImage) return;
        const ctx = currentQuiz.quizCtx;
        const img = currentQuiz.fullCardImage;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        switch (currentQuiz.type) {
            case 'enlarge': drawEnlargedImage(ctx, img, currentQuiz.attemptCount); break;
            case 'silhouette': drawSilhouetteImage(ctx, img); break;
            case 'mosaic': drawMosaicImage(ctx, currentQuiz.originalImageData, currentQuiz.attemptCount); break;
        }
    }

    function calculateCoverDrawDimensions(imgWidth, imgHeight, canvasWidth, canvasHeight, zoomFactor = 1) {
        const imgAspectRatio = imgWidth / imgHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        let scale;
        if (imgAspectRatio > canvasAspectRatio) {
            scale = canvasHeight / imgHeight;
        } else {
            scale = canvasWidth / imgWidth;
        }
        scale *= zoomFactor;
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;
        const drawX = (canvasWidth - drawWidth) / 2;
        const drawY = (canvasHeight - drawHeight) / 2;
        return { drawX, drawY, drawWidth, drawHeight };
    }

    function calculateContainDrawDimensions(imgWidth, imgHeight, canvasWidth, canvasHeight) {
        const imgAspectRatio = imgWidth / imgHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        let drawWidth, drawHeight;
        if (imgAspectRatio > canvasAspectRatio) {
            drawWidth = canvasWidth;
            drawHeight = canvasWidth / imgAspectRatio;
        } else {
            drawHeight = canvasHeight;
            drawWidth = canvasHeight * imgAspectRatio;
        }
        const drawX = (canvasWidth - drawWidth) / 2;
        const drawY = (canvasHeight - drawHeight) / 2;
        return { drawX, drawY, drawWidth, drawHeight };
    }

    function drawEnlargedImage(ctx, img, attempt) {
        const zoom = [0.01, 0.015, 0.03, 0.05, 0.1, 0.2][attempt] || 0.25;
        const sourceWidth = img.naturalWidth * zoom;
        const sourceHeight = img.naturalHeight * zoom;
        const sourceX = (img.naturalWidth - sourceWidth) / 2;
        const sourceY = (img.naturalHeight - sourceHeight) / 4;
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvasWidth, canvasHeight);
    }

    function drawSilhouetteImage(ctx, fullCardImg) {
        if (!currentQuiz.transparentCardImage) {
            console.error("Transparent image not loaded for silhouette quiz.");
            return;
        }
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        const CROP_X1 = 20;
        const CROP_Y1 = 90;
        const CROP_X2 = 457;
        const CROP_Y2 = 310;
        const CROP_WIDTH = CROP_X2 - CROP_X1;
        const CROP_HEIGHT = CROP_Y2 - CROP_Y1;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(fullCardImg, CROP_X1, CROP_Y1, CROP_WIDTH, CROP_HEIGHT, 0, 0, canvasWidth, canvasHeight);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasWidth;
        tempCanvas.height = canvasHeight;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.drawImage(currentQuiz.transparentCardImage, 0, 0, currentQuiz.transparentCardImage.naturalWidth, currentQuiz.transparentCardImage.naturalHeight, 0, 0, tempCanvas.width, tempCanvas.height);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) {
                data[i] = 0;
                data[i + 1] = 0;
                data[i + 2] = 0;
            }
        }
        tempCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0);
    }

    function drawMosaicImage(ctx, originalImageData, attempt) {
        const pixelSize = [128, 96, 64, 48, 32][attempt] || 1;
        const originalWidth = originalImageData.width;
        const originalHeight = originalImageData.height;
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        const tempMosaicCanvas = document.createElement('canvas');
        tempMosaicCanvas.width = originalWidth;
        tempMosaicCanvas.height = originalHeight;
        const tempMosaicCtx = tempMosaicCanvas.getContext('2d');

        for (let y = 0; y < originalHeight; y += pixelSize) {
            for (let x = 0; x < originalWidth; x += pixelSize) {
                const i = (y * originalWidth + x) * 4;
                tempMosaicCtx.fillStyle = `rgba(${originalImageData.data[i]},${originalImageData.data[i+1]},${originalImageData.data[i+2]},${originalImageData.data[i+3]/255})`;
                tempMosaicCtx.fillRect(x, y, pixelSize, pixelSize);
            }
        }
        ctx.drawImage(tempMosaicCanvas, 0, 0, canvasWidth, canvasHeight);
    }

    // ミニゲームの統計情報を更新する関数
    async function updateMinigameStats(quizType, isCorrect, hintsUsed = 0) {
        // localStorage を使用
        try {
            const stats = JSON.parse(localStorage.getItem('minigameStats') || '{}');

            if (!stats[quizType]) {
                stats[quizType] = { wins: 0, losses: 0, totalHints: 0 };
            }

            if (isCorrect) {
                stats[quizType].wins++;
                stats[quizType].totalHints += hintsUsed;
            } else {
                stats[quizType].losses++;
            }

            localStorage.setItem('minigameStats', JSON.stringify(stats));
            console.log(`Minigame stats updated for ${quizType}:`, stats[quizType]);
        } catch (error) {
            console.error("Failed to update minigame stats:", error);
        }
    }

    function checkAnswer() {
        if (!quizAnswerInput || !quizResultArea || !currentQuiz.card) return;
        const userAnswer = quizAnswerInput.value.trim();
        const correctAnswer = currentQuiz.card.name;
        const normalize = (str) => str.toLowerCase().replace(/\s/g, '').replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60));

        if (normalize(userAnswer) === normalize(correctAnswer)) {
            quizResultArea.textContent = '正解！';
            quizResultArea.className = 'quiz-result-area correct';
            endQuiz(true);
        } else {
            quizResultArea.textContent = '不正解...';
            quizResultArea.className = 'quiz-result-area incorrect';
            currentQuiz.attemptCount++;
            if (currentQuiz.type === 'cardName') {
                displayCardNameQuizHint();
            } else {
                currentQuiz.attemptCount < 5 ? drawQuizImage() : endQuiz(false);
            }
        }
    }

    function endQuiz(isCorrect) {
        quizAnswerInput.disabled = true;
        quizSubmitButton.style.display = 'none';
        quizNextButton.style.display = 'none';
        quizAnswerDisplay.innerHTML = `正解は「<strong>${currentQuiz.card.name}</strong>」でした！`;

        updateMinigameStats(currentQuiz.type, isCorrect, currentQuiz.hintIndex);

        if (currentQuiz.fullCardImage && currentQuiz.quizCtx) {
            const ctx = currentQuiz.quizCtx;
            const img = currentQuiz.fullCardImage;
            const parentWidth = quizImageArea.offsetWidth;
            const parentHeight = quizImageArea.offsetHeight;

            let targetWidth, targetHeight;
            const imgAspectRatio = img.naturalWidth / img.naturalHeight;
            const parentAspectRatio = parentWidth / parentHeight;

            if (imgAspectRatio > parentAspectRatio) {
                targetWidth = parentWidth;
                targetHeight = parentWidth / imgAspectRatio;
            } else {
                targetHeight = parentHeight;
                targetWidth = parentHeight * imgAspectRatio;
            }

            quizCanvas.width = targetWidth;
            quizCanvas.height = targetHeight;
            const { drawX, drawY, drawWidth, drawHeight } = calculateContainDrawDimensions(img.naturalWidth, img.naturalHeight, quizCanvas.width, quizCanvas.height);
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        }
        quizResetButton.style.display = 'inline-block';
    }

    quizCardNameButton.addEventListener('click', () => startQuiz('cardName'));
    quizIllustrationEnlargeButton.addEventListener('click', () => startQuiz('enlarge'));
    quizIllustrationSilhouetteButton.addEventListener('click', () => startQuiz('silhouette'));
    quizIllustrationMosaicButton.addEventListener('click', () => startQuiz('mosaic'));
    quizSubmitButton.addEventListener('click', checkAnswer);
    quizAnswerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkAnswer(); });
    quizResetButton.addEventListener('click', resetQuiz);

    resetQuiz();
}