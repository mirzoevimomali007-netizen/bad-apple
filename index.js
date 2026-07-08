const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');

const DATA_URL = 'https://raw.githubusercontent.com/Myriad-Dreamin/ascii-bad-apple/master/ascii_badapple.txt';
const LOCAL_FILE = path.join(__dirname, 'ascii_badapple.txt');

const WIDTH = 80;
const HEIGHT = 44;
const FPS = 30;
const FRAME_TIME = 1000 / FPS;

// ANSI Colors for premium styling
const COLOR_CYAN = '\x1b[36m';
const COLOR_GREEN = '\x1b[32m';
const COLOR_GRAY = '\x1b[90m';
const COLOR_RESET = '\x1b[0m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const RESET_CURSOR = '\x1b[H';
const CLEAR_SCREEN = '\x1b[2J';

// Download the text data if not exists
async function ensureDataFile() {
    if (fs.existsSync(LOCAL_FILE)) {
        console.log(`${COLOR_GREEN}✓ Найден локальный файл базы кадров.${COLOR_RESET}`);
        return;
    }

    console.log(`${COLOR_CYAN}Скачивание базы кадров Bad Apple (около 4.5 МБ)...${COLOR_RESET}`);
    
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(LOCAL_FILE);
        https.get(DATA_URL, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Ошибка загрузки: статус ${response.statusCode}`));
                return;
            }

            const totalBytes = parseInt(response.headers['content-length'], 10) || 4552399;
            let downloadedBytes = 0;

            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
                
                // Draw a sleek download progress bar
                const barWidth = 30;
                const filledWidth = Math.round((downloadedBytes / totalBytes) * barWidth);
                const bar = '█'.repeat(filledWidth) + '░'.repeat(barWidth - filledWidth);
                
                readline.cursorTo(process.stdout, 0);
                process.stdout.write(`${COLOR_CYAN}[${bar}] ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB)${COLOR_RESET}`);
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`\n${COLOR_GREEN}✓ Загрузка завершена!${COLOR_RESET}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(LOCAL_FILE, () => {});
            reject(err);
        });
    });
}

// Parse frames from the bitmask file
function loadFrames() {
    console.log(`${COLOR_CYAN}Загрузка и парсинг кадров...${COLOR_RESET}`);
    const data = fs.readFileSync(LOCAL_FILE, 'utf8');
    const lines = data.split('\n');
    const numberLines = [];

    // Extract valid numeric lines (ignoring empty lines or metadata if any)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && /^[0-9\s]+$/.test(line)) {
            numberLines.push(line);
        }
    }

    const totalLines = numberLines.length;
    const totalFrames = Math.floor(totalLines / 11);
    console.log(`${COLOR_GREEN}✓ Успешно загружено ${totalFrames} кадров.${COLOR_RESET}`);

    return { numberLines, totalFrames };
}

// Convert 11 lines of BigInts into a displayable string
function renderFrame(numberLines, frameIdx) {
    const startLine = frameIdx * 11;
    const bigInts = [];
    
    for (let i = 0; i < 11; i++) {
        const lineParts = numberLines[startLine + i].split(/\s+/);
        for (let j = 0; j < lineParts.length; j++) {
            if (lineParts[j]) {
                bigInts.push(BigInt(lineParts[j]));
            }
        }
    }

    let frameStr = '';
    // Decode bits (LSB-first, standard for Myriad-Dreamin/ascii-bad-apple data structure)
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const bitIndex = y * WIDTH + x;
            const bigIntIndex = Math.floor(bitIndex / 64);
            const bitPos = BigInt(bitIndex % 64);
            
            const val = bigInts[bigIntIndex];
            const isSet = (val & (1n << bitPos)) !== 0n;
            
            // We use solid block character '█' for white and spaces for black
            frameStr += isSet ? '█' : ' ';
        }
        frameStr += '\n';
    }

    return frameStr;
}

// Format duration to MM:SS
function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// Start the interactive player loop
async function play() {
    try {
        await ensureDataFile();
        const { numberLines, totalFrames } = loadFrames();

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log(`\n${COLOR_CYAN}Растяни окно терминала пошире, чтобы ролик отображался корректно.${COLOR_RESET}`);
        rl.question(`Нажми [ENTER], чтобы запустить воспроизведение...`, () => {
            rl.close();
            
            // Hide cursor and clear screen to start playing
            process.stdout.write(HIDE_CURSOR + CLEAR_SCREEN);

            let currentFrame = 0;
            const startTime = Date.now();
            let lastUpdate = Date.now();
            let fpsCounter = 0;
            let currentFps = 30;

            function updateLoop() {
                if (currentFrame >= totalFrames) {
                    process.stdout.write(SHOW_CURSOR);
                    console.log(`\n${COLOR_GREEN}Воспроизведение завершено!${COLOR_RESET}`);
                    process.exit(0);
                }

                // Render current frame
                const frameContent = renderFrame(numberLines, currentFrame);

                // Stats calculation
                const elapsedSeconds = (Date.now() - startTime) / 1000;
                const totalSeconds = totalFrames / FPS;
                const progressPercent = Math.min(100, (currentFrame / totalFrames) * 100).toFixed(1);
                
                const barWidth = 30;
                const filledWidth = Math.round((currentFrame / totalFrames) * barWidth);
                const progressBar = COLOR_CYAN + '█'.repeat(filledWidth) + COLOR_GRAY + '░'.repeat(barWidth - filledWidth) + COLOR_RESET;

                // FPS display
                fpsCounter++;
                const now = Date.now();
                if (now - lastUpdate >= 1000) {
                    currentFps = fpsCounter;
                    fpsCounter = 0;
                    lastUpdate = now;
                }

                // Assemble premium console interface frame
                const uiFrame = 
                    RESET_CURSOR + 
                    COLOR_CYAN + frameContent + COLOR_RESET + 
                    `${COLOR_GRAY}─`.repeat(WIDTH) + '\n' +
                    ` Progress: ${progressBar} ${COLOR_CYAN}${progressPercent}%${COLOR_RESET} | ` +
                    `Time: ${COLOR_CYAN}${formatTime(elapsedSeconds)} / ${formatTime(totalSeconds)}${COLOR_RESET} | ` +
                    `FPS: ${COLOR_GREEN}${currentFps}${COLOR_RESET}\n`;

                process.stdout.write(uiFrame);

                // Target timing calculation to stay in sync with real-time 30 FPS
                currentFrame++;
                const nextFrameTargetTime = startTime + (currentFrame * FRAME_TIME);
                const delay = Math.max(0, nextFrameTargetTime - Date.now());

                setTimeout(updateLoop, delay);
            }

            // Begin the playback loop
            updateLoop();
        });

    } catch (err) {
        console.error(`${COLOR_RESET}Произошла ошибка:`, err);
        process.stdout.write(SHOW_CURSOR);
    }
}

play();