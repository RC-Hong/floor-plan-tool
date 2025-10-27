// 畫布設定
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// 狀態管理
let shapes = [];
let currentTool = null;
let isDrawing = false;
let startX, startY;
let currentColor = '#000000';
let currentLineWidth = 2;
let backgroundImage = null;
let selectedShapeIndex = -1;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let isResizing = false;
let resizeHandle = null;
let selectedShapesForMerge = []; // 用於儲存要合併的矩形

// 按鈕元素
const imageUpload = document.getElementById('imageUpload');
const uploadBtn = document.getElementById('uploadBtn');
const downloadBtn = document.getElementById('downloadBtn');
const downloadJSONBtn = document.getElementById('downloadJSONBtn');
const detectBtn = document.getElementById('detectBtn');
const clearBtn = document.getElementById('clearBtn');
const mergeBtn = document.getElementById('mergeBtn');
const cancelMergeBtn = document.getElementById('cancelMergeBtn');
const selectBtn = document.getElementById('selectBtn');
const lineBtn = document.getElementById('lineBtn');
const rectBtn = document.getElementById('rectBtn');
const circleBtn = document.getElementById('circleBtn');
const colorPicker = document.getElementById('colorPicker');
const lineWidth = document.getElementById('lineWidth');
const lineWidthValue = document.getElementById('lineWidthValue');
const shapesList = document.getElementById('shapesList');

// 工具選擇
function selectTool(tool, btn) {
    currentTool = tool;
    selectedShapeIndex = -1;
    document.querySelectorAll('.btn-info').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    redraw();
}

selectBtn.addEventListener('click', () => selectTool('select', selectBtn));
lineBtn.addEventListener('click', () => selectTool('line', lineBtn));
rectBtn.addEventListener('click', () => selectTool('rect', rectBtn));
circleBtn.addEventListener('click', () => selectTool('circle', circleBtn));

// 顏色和粗細
colorPicker.addEventListener('change', (e) => {
    currentColor = e.target.value;
});

lineWidth.addEventListener('input', (e) => {
    currentLineWidth = e.target.value;
    lineWidthValue.textContent = e.target.value;
});

// 點擊按鈕觸發檔案選擇
uploadBtn.addEventListener('click', () => {
    imageUpload.click();
});

// 上傳圖片
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                backgroundImage = img;
                redraw();
                alert('圖片已上傳！點擊「辨識圖形」按鈕來自動識別線段、矩形和圓形。');
            };
            img.onerror = () => {
                alert('圖片載入失敗，請重試');
            };
            img.src = event.target.result;
        };
        reader.onerror = () => {
            alert('檔案讀取失敗，請重試');
        };
        reader.readAsDataURL(file);
    }
});

// 辨識圖形按鈕
detectBtn.addEventListener('click', () => {
    if (!backgroundImage) {
        alert('請先上傳圖片！');
        return;
    }
    
    if (confirm('開始辨識圖形？這將清除現有的圖形。')) {
        detectShapes();
    }
});

// 圖形辨識功能
function detectShapes() {
    // 創建臨時 canvas 來處理圖片
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // 計算縮放比例
    const scale = Math.min(
        canvas.width / backgroundImage.width,
        canvas.height / backgroundImage.height
    );
    
    const scaledWidth = backgroundImage.width * scale;
    const scaledHeight = backgroundImage.height * scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;
    
    tempCanvas.width = scaledWidth;
    tempCanvas.height = scaledHeight;
    
    // 繪製圖片到臨時 canvas
    tempCtx.drawImage(backgroundImage, 0, 0, scaledWidth, scaledHeight);
    
    // 獲取圖片數據
    const imageData = tempCtx.getImageData(0, 0, scaledWidth, scaledHeight);
    
    // 簡易的邊緣檢測和形狀識別
    shapes = [];
    
    // 使用簡單的邊緣檢測
    const detected = simpleShapeDetection(imageData, offsetX, offsetY);
    shapes = detected;
    
    redraw();
    updateShapesList();
    
    alert(`已辨識 ${shapes.length} 個圖形！您可以使用「選取/移動」工具來編輯它們。`);
}

// 改進的圖形檢測 - 矩形優先
function simpleShapeDetection(imageData, offsetX, offsetY) {
    const detectedShapes = [];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // 二值化圖像
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        binary[i] = gray < 128 ? 1 : 0;
    }
    
    // 檢測所有矩形（包括嵌套的）
    const rectangles = detectAllRectangles(binary, width, height, offsetX, offsetY);
    
    // **只保留矩形，不要線段**
    rectangles.forEach(rect => {
        detectedShapes.push({
            type: 'rect',
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            color: '#00ff00',
            lineWidth: 2
        });
    });
    
    return detectedShapes;
}

// 檢測所有矩形（包括嵌套矩形）
function detectAllRectangles(binary, width, height, offsetX, offsetY) {
    const rectangles = [];
    
    // 使用更精確的方法：檢測水平和垂直線，然後組合成矩形
    const horizontalLines = detectHorizontalLines(binary, width, height);
    const verticalLines = detectVerticalLines(binary, width, height);
    
    console.log(`檢測到 ${horizontalLines.length} 條水平線`);
    console.log(`檢測到 ${verticalLines.length} 條垂直線`);
    
    // 從線條組合出矩形
    const lineRects = findRectanglesFromLines(horizontalLines, verticalLines, width, height, offsetX, offsetY);
    
    console.log(`組合出 ${lineRects.length} 個矩形`);
    
    // 去重
    const uniqueRects = removeDuplicateRectangles(lineRects);
    
    // 按面積排序（大到小）
    uniqueRects.sort((a, b) => b.area - a.area);
    
    return uniqueRects;
}

// 從角落尋找矩形
function findRectangleFromCorner(binary, width, height, startX, startY) {
    // 向右尋找
    let rightX = startX;
    while (rightX < width && binary[startY * width + rightX] === 1) {
        rightX++;
    }
    
    // 向下尋找
    let bottomY = startY;
    while (bottomY < height && binary[bottomY * width + startX] === 1) {
        bottomY++;
    }
    
    const rectWidth = rightX - startX;
    const rectHeight = bottomY - startY;
    
    if (rectWidth < 5 || rectHeight < 5) return null;
    
    return {
        x: startX,
        y: startY,
        width: rectWidth,
        height: rectHeight
    };
}

// 檢測水平線
function detectHorizontalLines(binary, width, height) {
    const lines = [];
    
    for (let y = 0; y < height; y++) {
        let lineStart = -1;
        let lineLength = 0;
        
        for (let x = 0; x < width; x++) {
            if (binary[y * width + x] === 1) {
                if (lineStart === -1) {
                    lineStart = x;
                }
                lineLength++;
            } else {
                if (lineLength > 10) { // 降低到最低要求
                    lines.push({
                        y: y,
                        x1: lineStart,
                        x2: lineStart + lineLength - 1,
                        length: lineLength
                    });
                }
                lineStart = -1;
                lineLength = 0;
            }
        }
        
        if (lineLength > 10) {
            lines.push({
                y: y,
                x1: lineStart,
                x2: lineStart + lineLength - 1,
                length: lineLength
            });
        }
    }
    
    return lines;
}

// 檢測垂直線
function detectVerticalLines(binary, width, height) {
    const lines = [];
    
    for (let x = 0; x < width; x++) {
        let lineStart = -1;
        let lineLength = 0;
        
        for (let y = 0; y < height; y++) {
            if (binary[y * width + x] === 1) {
                if (lineStart === -1) {
                    lineStart = y;
                }
                lineLength++;
            } else {
                if (lineLength > 10) { // 降低到最低要求
                    lines.push({
                        x: x,
                        y1: lineStart,
                        y2: lineStart + lineLength - 1,
                        length: lineLength
                    });
                }
                lineStart = -1;
                lineLength = 0;
            }
        }
        
        if (lineLength > 10) {
            lines.push({
                x: x,
                y1: lineStart,
                y2: lineStart + lineLength - 1,
                length: lineLength
            });
        }
    }
    
    return lines;
}

// 從線條組合出矩形
function findRectanglesFromLines(hLines, vLines, width, height, offsetX, offsetY) {
    const rectangles = [];
    const tolerance = 8;
    
    console.log(`原始水平線: ${hLines.length} 條`);
    console.log(`原始垂直線: ${vLines.length} 條`);
    
    if (hLines.length === 0 || vLines.length === 0) {
        console.log('警告：沒有檢測到線條！');
        return rectangles;
    }
    
    // 將相近的水平線分組
    const hGroups = groupNearbyLines(hLines, 'y', tolerance);
    // 將相近的垂直線分組
    const vGroups = groupNearbyLines(vLines, 'x', tolerance);
    
    console.log(`水平線分組: ${hGroups.length} 組`);
    hGroups.forEach((g, i) => {
        const maxLen = Math.max(...g.lines.map(l => l.length));
        console.log(`  H${i}: y=${g.avgPos}, 包含${g.lines.length}條線, 最長=${maxLen}px`);
    });
    
    console.log(`垂直線分組: ${vGroups.length} 組`);
    vGroups.forEach((g, i) => {
        const maxLen = Math.max(...g.lines.map(l => l.length));
        console.log(`  V${i}: x=${g.avgPos}, 包含${g.lines.length}條線, 最長=${maxLen}px`);
    });
    
    // 智能過濾：區分主線條和內部短線
    const minMainLineLength = width * 0.5; // 主分隔線至少50%寬度
    const minInnerLineLength = 15; // 內部線條最少15px
    
    console.log(`主線條過濾門檻: ${Math.round(minMainLineLength)}px (50%寬度)`);
    console.log(`內部線條過濾門檻: ${minInnerLineLength}px`);
    
    // 先找出所有主線條（長線）
    const mainHGroups = hGroups.filter(g => {
        const maxLen = Math.max(...g.lines.map(l => l.length));
        return maxLen >= minMainLineLength;
    });
    
    console.log(`主水平線: ${mainHGroups.length} 組`);
    mainHGroups.forEach((g, i) => {
        const maxLen = Math.max(...g.lines.map(l => l.length));
        console.log(`  主線 H${i}: y=${g.avgPos}, 長度=${maxLen}px`);
    });
    
    // 再找內部短線，但只在主線條之間的區域，並過濾過於密集的線
    const innerHGroups = [];
    if (mainHGroups.length >= 2) {
        for (let i = 0; i < mainHGroups.length - 1; i++) {
            const topY = mainHGroups[i].avgPos;
            const bottomY = mainHGroups[i + 1].avgPos;
            const regionHeight = bottomY - topY;
            
            // 找這個區域內的短線
            let linesInRegion = hGroups.filter(g => {
                const maxLen = Math.max(...g.lines.map(l => l.length));
                return g.avgPos > topY + 10 && 
                       g.avgPos < bottomY - 10 && 
                       maxLen >= minInnerLineLength &&
                       maxLen < minMainLineLength;
            });
            
            // 如果區域內有多條線，只保留最長的1-2條（過濾噪點）
            if (linesInRegion.length > 2) {
                // 按長度排序，只保留最長的2條
                linesInRegion.sort((a, b) => {
                    const maxA = Math.max(...a.lines.map(l => l.length));
                    const maxB = Math.max(...b.lines.map(l => l.length));
                    return maxB - maxA;
                });
                linesInRegion = linesInRegion.slice(0, 2);
                console.log(`  區域 y=${topY}-${bottomY} (高度=${regionHeight}) 內原有多條線，保留最長的 ${linesInRegion.length} 條`);
            } else if (linesInRegion.length > 0) {
                console.log(`  區域 y=${topY}-${bottomY} (高度=${regionHeight}) 內有 ${linesInRegion.length} 條內部線`);
            }
            
            // 如果區域太小，不要添加內部線
            if (regionHeight > 80) {
                innerHGroups.push(...linesInRegion);
            } else {
                console.log(`  區域 y=${topY}-${bottomY} 太小(${regionHeight}px)，忽略內部線`);
            }
        }
    }
    
    // 合併主線和內部線
    const filteredHGroups = [...mainHGroups, ...innerHGroups];
    
    // 垂直線：只保留長線（外框）
    const filteredVGroups = vGroups.filter(g => {
        const maxLen = Math.max(...g.lines.map(l => l.length));
        return maxLen >= height * 0.3;
    });
    
    console.log(`有效水平線: ${filteredHGroups.length} 組`);
    filteredHGroups.forEach((g, i) => {
        const maxLen = Math.max(...g.lines.map(l => l.length));
        console.log(`  ✓ H${i}: y=${g.avgPos}, 最長=${maxLen}px`);
    });
    
    console.log(`有效垂直線: ${filteredVGroups.length} 組`);
    filteredVGroups.forEach((g, i) => {
        const maxLen = Math.max(...g.lines.map(l => l.length));
        console.log(`  ✓ V${i}: x=${g.avgPos}, 最長=${maxLen}px`);
    });
    
    // 必須至少有2條水平線和2條垂直線才能組成矩形
    if (filteredHGroups.length < 2 || filteredVGroups.length < 2) {
        console.log(`線條數量不足！水平:${filteredHGroups.length} 垂直:${filteredVGroups.length}`);
        return rectangles;
    }
    
    // 組合成矩形（只保留相鄰線條之間的矩形）
    const sortedHGroups = [...filteredHGroups].sort((a, b) => a.avgPos - b.avgPos);
    
    for (let i = 0; i < sortedHGroups.length - 1; i++) {
        // 只與下一條線組合（相鄰）
        const top = sortedHGroups[i];
        const bottom = sortedHGroups[i + 1];
        
        const rectHeight = bottom.avgPos - top.avgPos;
        
        // 過濾太小的間隔
        if (rectHeight < 10) continue;
        
        for (let m = 0; m < filteredVGroups.length; m++) {
            for (let n = 0; n < filteredVGroups.length; n++) {
                if (m === n) continue;
                
                const left = filteredVGroups[m];
                const right = filteredVGroups[n];
                
                if (right.avgPos <= left.avgPos + 10) continue;
                
                const rectWidth = right.avgPos - left.avgPos;
                
                if (rectWidth > 15 && rectHeight > 15) {
                    rectangles.push({
                        x: left.avgPos + offsetX,
                        y: top.avgPos + offsetY,
                        width: rectWidth,
                        height: rectHeight,
                        area: rectWidth * rectHeight
                    });
                }
            }
        }
    }
    
    console.log(`組合出 ${rectangles.length} 個矩形`);
    
    return rectangles;
}

// 將相近的線分組
function groupNearbyLines(lines, posKey, tolerance) {
    if (lines.length === 0) return [];
    
    const sorted = [...lines].sort((a, b) => a[posKey] - b[posKey]);
    const groups = [];
    let currentGroup = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
        // 如果與前一條線的距離在容忍範圍內，加入同一組
        if (sorted[i][posKey] - sorted[i-1][posKey] <= tolerance) {
            currentGroup.push(sorted[i]);
        } else {
            // 否則，結束當前組，開始新組
            if (currentGroup.length > 0) {
                // 計算平均位置（使用最長的線的位置）
                const longestLine = currentGroup.reduce((max, line) => 
                    line.length > max.length ? line : max, currentGroup[0]);
                groups.push({ 
                    pos: longestLine[posKey], 
                    lines: currentGroup,
                    avgPos: Math.round(currentGroup.reduce((sum, line) => sum + line[posKey], 0) / currentGroup.length)
                });
            }
            currentGroup = [sorted[i]];
        }
    }
    
    // 處理最後一組
    if (currentGroup.length > 0) {
        const longestLine = currentGroup.reduce((max, line) => 
            line.length > max.length ? line : max, currentGroup[0]);
        groups.push({ 
            pos: longestLine[posKey], 
            lines: currentGroup,
            avgPos: Math.round(currentGroup.reduce((sum, line) => sum + line[posKey], 0) / currentGroup.length)
        });
    }
    
    return groups;
}

// 去除重複的矩形（保留嵌套結構）
function removeDuplicateRectangles(rectangles) {
    const unique = [];
    const tolerance = 5; // 降低容忍度
    
    rectangles.forEach(rect => {
        let isDuplicate = false;
        
        for (let i = 0; i < unique.length; i++) {
            const existing = unique[i];
            
            // 只檢查位置和大小是否幾乎相同（真正的重複）
            if (Math.abs(rect.x - existing.x) < tolerance &&
                Math.abs(rect.y - existing.y) < tolerance &&
                Math.abs(rect.width - existing.width) < tolerance &&
                Math.abs(rect.height - existing.height) < tolerance) {
                isDuplicate = true;
                // 保留較大的
                if (rect.area > existing.area) {
                    unique[i] = rect;
                }
                break;
            }
        }
        
        if (!isDuplicate) {
            unique.push(rect);
        }
    });
    
    console.log(`去重後: ${unique.length} 個矩形`);
    
    // 按 y 座標排序（從上到下）
    unique.sort((a, b) => a.y - b.y);
    
    return unique;
}

// 尋找輪廓
function findContours(binary, width, height) {
    const visited = new Uint8Array(width * height);
    const contours = [];
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (binary[idx] === 1 && !visited[idx]) {
                const contour = traceContour(binary, visited, width, height, x, y);
                if (contour.length > 20) { // 最小輪廓點數
                    contours.push(contour);
                }
            }
        }
    }
    
    return contours;
}

// 追蹤輪廓
function traceContour(binary, visited, width, height, startX, startY) {
    const contour = [];
    const stack = [{x: startX, y: startY}];
    const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
    const dy = [-1, -1, -1, 0, 0, 1, 1, 1];
    
    while (stack.length > 0) {
        const {x, y} = stack.pop();
        const idx = y * width + x;
        
        if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || binary[idx] === 0) {
            continue;
        }
        
        visited[idx] = 1;
        contour.push({x, y});
        
        for (let i = 0; i < 8; i++) {
            stack.push({x: x + dx[i], y: y + dy[i]});
        }
    }
    
    return contour;
}

// 擬合矩形
function fitRectangle(contour, offsetX, offsetY) {
    if (contour.length < 4) return null;
    
    // 計算邊界框
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    contour.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // 過濾太小或太大的矩形
    if (width < 20 || height < 20 || width > 600 || height > 600) {
        return null;
    }
    
    // 計算矩形度（contour點在邊界上的比例）
    let onEdge = 0;
    const tolerance = 3;
    
    contour.forEach(p => {
        if ((Math.abs(p.x - minX) < tolerance || Math.abs(p.x - maxX) < tolerance) ||
            (Math.abs(p.y - minY) < tolerance || Math.abs(p.y - maxY) < tolerance)) {
            onEdge++;
        }
    });
    
    const confidence = onEdge / contour.length;
    
    // 只接受高矩形度的形狀
    if (confidence < 0.5) {
        return null;
    }
    
    return {
        x: minX + offsetX,
        y: minY + offsetY,
        width: width,
        height: height,
        confidence: confidence
    };
}

// 擬合線段
function fitLine(contour, offsetX, offsetY) {
    if (contour.length < 10) return null;
    
    // 使用最小二乘法擬合直線
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    contour.forEach(p => {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumX2 += p.x * p.x;
    });
    
    const n = contour.length;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // 計算擬合誤差
    let totalError = 0;
    contour.forEach(p => {
        const expectedY = slope * p.x + intercept;
        totalError += Math.abs(p.y - expectedY);
    });
    
    const avgError = totalError / n;
    const confidence = avgError < 5 ? 1 - (avgError / 5) : 0;
    
    if (confidence < 0.6) {
        return null;
    }
    
    // 找出線段端點
    let minX = Infinity, maxX = -Infinity;
    let p1, p2;
    
    contour.forEach(p => {
        if (p.x < minX) {
            minX = p.x;
            p1 = p;
        }
        if (p.x > maxX) {
            maxX = p.x;
            p2 = p;
        }
    });
    
    // 線段太短則忽略
    const length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    if (length < 30) {
        return null;
    }
    
    return {
        x1: p1.x + offsetX,
        y1: p1.y + offsetY,
        x2: p2.x + offsetX,
        y2: p2.y + offsetY,
        confidence: confidence
    };
}

// 擬合圓形
function fitCircle(contour, offsetX, offsetY) {
    if (contour.length < 20) return null;
    
    // 計算中心點
    let centerX = 0, centerY = 0;
    contour.forEach(p => {
        centerX += p.x;
        centerY += p.y;
    });
    centerX /= contour.length;
    centerY /= contour.length;
    
    // 計算平均半徑
    let avgRadius = 0;
    contour.forEach(p => {
        avgRadius += Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2));
    });
    avgRadius /= contour.length;
    
    // 計算半徑變異度
    let variance = 0;
    contour.forEach(p => {
        const r = Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2));
        variance += Math.pow(r - avgRadius, 2);
    });
    variance = Math.sqrt(variance / contour.length);
    
    const confidence = variance < avgRadius * 0.15 ? 1 - (variance / (avgRadius * 0.15)) : 0;
    
    if (confidence < 0.7 || avgRadius < 15 || avgRadius > 300) {
        return null;
    }
    
    return {
        x: centerX + offsetX,
        y: centerY + offsetY,
        radius: avgRadius,
        confidence: confidence
    };
}

// 繪製背景圖片
function drawBackground() {
    if (backgroundImage) {
        const scale = Math.min(
            canvas.width / backgroundImage.width,
            canvas.height / backgroundImage.height
        );
        const x = (canvas.width - backgroundImage.width * scale) / 2;
        const y = (canvas.height - backgroundImage.height * scale) / 2;
        ctx.drawImage(
            backgroundImage,
            x, y,
            backgroundImage.width * scale,
            backgroundImage.height * scale
        );
    }
}

// 繪製所有圖形
function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    shapes.forEach((shape, index) => {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.lineWidth;
        ctx.fillStyle = shape.color;
        
        const isSelected = index === selectedShapeIndex;
        const isSelectedForMerge = isMergeMode && selectedShapesForMerge.includes(index);
        
        if (isSelectedForMerge) {
            ctx.strokeStyle = '#9C27B0';
            ctx.lineWidth = shape.lineWidth + 3;
        } else if (isSelected) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = shape.lineWidth + 2;
        }
        
        switch (shape.type) {
            case 'line':
                ctx.beginPath();
                ctx.moveTo(shape.x1, shape.y1);
                ctx.lineTo(shape.x2, shape.y2);
                ctx.stroke();
                break;
            case 'rect':
                ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
                break;
            case 'circle':
                ctx.beginPath();
                ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
                ctx.stroke();
                break;
        }
        
        // 繪製選取框和控制點
        if (isSelected && currentTool === 'select' && !isMergeMode) {
            drawSelectionHandles(shape);
        }
    });
}

// 繪製選取控制點
function drawSelectionHandles(shape) {
    ctx.fillStyle = '#0080ff';
    const handleSize = 8;
    
    switch (shape.type) {
        case 'line':
            // 線段兩端的控制點
            ctx.fillRect(shape.x1 - handleSize/2, shape.y1 - handleSize/2, handleSize, handleSize);
            ctx.fillRect(shape.x2 - handleSize/2, shape.y2 - handleSize/2, handleSize, handleSize);
            break;
        case 'rect':
            // 矩形四角和四邊中點
            ctx.fillRect(shape.x - handleSize/2, shape.y - handleSize/2, handleSize, handleSize);
            ctx.fillRect(shape.x + shape.width - handleSize/2, shape.y - handleSize/2, handleSize, handleSize);
            ctx.fillRect(shape.x - handleSize/2, shape.y + shape.height - handleSize/2, handleSize, handleSize);
            ctx.fillRect(shape.x + shape.width - handleSize/2, shape.y + shape.height - handleSize/2, handleSize, handleSize);
            break;
        case 'circle':
            // 圓形的上下左右四個控制點
            ctx.fillRect(shape.x - handleSize/2, shape.y - shape.radius - handleSize/2, handleSize, handleSize);
            ctx.fillRect(shape.x - handleSize/2, shape.y + shape.radius - handleSize/2, handleSize, handleSize);
            ctx.fillRect(shape.x - shape.radius - handleSize/2, shape.y - handleSize/2, handleSize, handleSize);
            ctx.fillRect(shape.x + shape.radius - handleSize/2, shape.y - handleSize/2, handleSize, handleSize);
            break;
    }
}

// 繪製預覽
function drawPreview(x, y) {
    redraw();
    
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentLineWidth;
    ctx.fillStyle = currentColor;
    
    switch (currentTool) {
        case 'line':
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.stroke();
            break;
        case 'rect':
            const width = x - startX;
            const height = y - startY;
            ctx.strokeRect(startX, startY, width, height);
            break;
        case 'circle':
            const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
            ctx.beginPath();
            ctx.arc(startX, startY, radius, 0, Math.PI * 2);
            ctx.stroke();
            break;
    }
}

// 檢查是否點擊到圖形
function getShapeAtPosition(x, y) {
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        
        switch (shape.type) {
            case 'line':
                const dist = distanceToLine(x, y, shape.x1, shape.y1, shape.x2, shape.y2);
                if (dist < 10) return i;
                break;
            case 'rect':
                if (x >= shape.x && x <= shape.x + shape.width &&
                    y >= shape.y && y <= shape.y + shape.height) {
                    return i;
                }
                break;
            case 'circle':
                const distance = Math.sqrt(Math.pow(x - shape.x, 2) + Math.pow(y - shape.y, 2));
                if (Math.abs(distance - shape.radius) < 10) return i;
                break;
        }
    }
    return -1;
}

// 計算點到線段的距離
function distanceToLine(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// 滑鼠事件
canvas.addEventListener('mousedown', (e) => {
    if (!currentTool) return;
    
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    
    if (currentTool === 'select') {
        // 選取模式
        const shapeIndex = getShapeAtPosition(startX, startY);
        if (shapeIndex !== -1) {
            selectedShapeIndex = shapeIndex;
            isDragging = true;
            const shape = shapes[shapeIndex];
            
            // 計算拖曳偏移
            switch (shape.type) {
                case 'line':
                    dragOffsetX = startX - shape.x1;
                    dragOffsetY = startY - shape.y1;
                    break;
                case 'rect':
                    dragOffsetX = startX - shape.x;
                    dragOffsetY = startY - shape.y;
                    break;
                case 'circle':
                    dragOffsetX = startX - shape.x;
                    dragOffsetY = startY - shape.y;
                    break;
            }
            redraw();
            updateShapesList();
        } else {
            selectedShapeIndex = -1;
            redraw();
            updateShapesList();
        }
    } else {
        isDrawing = true;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (currentTool === 'select' && isDragging && selectedShapeIndex !== -1) {
        // 拖曳圖形
        const shape = shapes[selectedShapeIndex];
        const dx = x - startX;
        const dy = y - startY;
        
        switch (shape.type) {
            case 'line':
                shape.x1 += dx;
                shape.y1 += dy;
                shape.x2 += dx;
                shape.y2 += dy;
                break;
            case 'rect':
                shape.x += dx;
                shape.y += dy;
                break;
            case 'circle':
                shape.x += dx;
                shape.y += dy;
                break;
        }
        
        startX = x;
        startY = y;
        redraw();
    } else if (isDrawing && currentTool !== 'select') {
        drawPreview(x, y);
    }
    
    // 更新滑鼠游標
    if (currentTool === 'select') {
        const shapeIndex = getShapeAtPosition(x, y);
        canvas.style.cursor = shapeIndex !== -1 ? 'move' : 'default';
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (currentTool === 'select') {
        isDragging = false;
        isResizing = false;
        updateShapesList();
    } else if (isDrawing) {
        const rect = canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;
        
        let shape = {
            color: currentColor,
            lineWidth: currentLineWidth
        };
        
        switch (currentTool) {
            case 'line':
                shape.type = 'line';
                shape.x1 = startX;
                shape.y1 = startY;
                shape.x2 = endX;
                shape.y2 = endY;
                break;
            case 'rect':
                shape.type = 'rect';
                shape.x = startX;
                shape.y = startY;
                shape.width = endX - startX;
                shape.height = endY - startY;
                break;
            case 'circle':
                shape.type = 'circle';
                shape.x = startX;
                shape.y = startY;
                shape.radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                break;
        }
        
        shapes.push(shape);
        isDrawing = false;
        redraw();
        updateShapesList();
    }
});

// 更新圖形列表
function updateShapesList() {
    shapesList.innerHTML = '';
    
    // 如果在合併模式，顯示提示和執行按鈕
    if (isMergeMode) {
        const mergeHeader = document.createElement('div');
        mergeHeader.style.cssText = 'background: #9C27B0; color: white; padding: 10px; margin-bottom: 10px; border-radius: 5px; text-align: center;';
        mergeHeader.innerHTML = `
            <strong>🔗 合併模式</strong><br>
            <small>已選擇 ${selectedShapesForMerge.length} 個矩形</small><br>
            <button onclick="executeMerge()" style="margin-top: 8px; padding: 5px 15px; background: white; color: #9C27B0; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                ✓ 執行合併
            </button>
        `;
        shapesList.appendChild(mergeHeader);
    }
    
    // 按面積排序，最大的是外框
    const sortedShapes = shapes.map((shape, index) => ({shape, index}))
        .sort((a, b) => b.shape.area - a.shape.area);
    
    sortedShapes.forEach(({shape, index}, sortIndex) => {
        const item = document.createElement('div');
        item.className = 'shape-item';
        
        // 合併模式下的選中效果
        if (isMergeMode && selectedShapesForMerge.includes(index)) {
            item.style.border = '3px solid #9C27B0';
            item.style.backgroundColor = '#f3e5f5';
        } else if (index === selectedShapeIndex) {
            item.style.border = '2px solid #ff0000';
            item.style.backgroundColor = '#fff5f5';
        }
        
        let info = '';
        let levelLabel = '';
        
        // 判斷層級
        if (sortIndex === 0) {
            levelLabel = '🔲 外框';
            item.style.borderLeft = '4px solid #2196F3';
        } else if (shape.area > sortedShapes[0].shape.area * 0.2) {
            levelLabel = '📦 主分區';
            item.style.borderLeft = '4px solid #4CAF50';
        } else {
            levelLabel = '📋 子分區';
            item.style.borderLeft = '4px solid #FF9800';
        }
        
        switch (shape.type) {
            case 'line':
                info = `📏 線段 (${Math.round(shape.x1)}, ${Math.round(shape.y1)}) → (${Math.round(shape.x2)}, ${Math.round(shape.y2)})`;
                break;
            case 'rect':
                info = `${levelLabel} 位置:(${Math.round(shape.x)}, ${Math.round(shape.y)}) 大小:${Math.round(shape.width)}×${Math.round(shape.height)}`;
                break;
            case 'circle':
                info = `⭕ 圓形 中心:(${Math.round(shape.x)}, ${Math.round(shape.y)}) 半徑:${Math.round(shape.radius)}`;
                break;
        }
        
        // 合併模式下的按鈕
        let actionButtons = '';
        if (isMergeMode && shape.type === 'rect') {
            const isSelected = selectedShapesForMerge.includes(index);
            actionButtons = `
                <button onclick="toggleShapeForMerge(${index})" style="background: ${isSelected ? '#9C27B0' : '#E0E0E0'}; color: ${isSelected ? 'white' : '#666'}; padding: 5px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                    ${isSelected ? '☑' : '☐'} ${isSelected ? '已選' : '選取'}
                </button>
            `;
        } else {
            actionButtons = `
                <button onclick="selectShapeFromList(${index})" style="background: #17a2b8; color: white;">選取</button>
                <button onclick="editShape(${index})" style="background: #ffc107;">編輯</button>
                <button onclick="deleteShape(${index})" style="background: #dc3545; color: white;">刪除</button>
            `;
        }
        
        item.innerHTML = `
            <div class="shape-info">
                <strong>${info}</strong>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    顏色: <span style="display: inline-block; width: 20px; height: 20px; background: ${shape.color}; border: 1px solid #ccc; vertical-align: middle;"></span>
                    粗細: ${shape.lineWidth}px | 
                    面積: ${Math.round(shape.area)}px²
                </div>
            </div>
            <div class="shape-actions">
                ${actionButtons}
            </div>
        `;
        
        shapesList.appendChild(item);
    });
}

// 從列表選取圖形
function selectShapeFromList(index) {
    selectedShapeIndex = index;
    selectTool('select', selectBtn);
    redraw();
    updateShapesList();
}

// 編輯圖形
function editShape(index) {
    const shape = shapes[index];
    
    const newColor = prompt('輸入新顏色（例如：#ff0000）', shape.color);
    if (newColor) shape.color = newColor;
    
    const newWidth = prompt('輸入新粗細（1-20）', shape.lineWidth);
    if (newWidth && !isNaN(newWidth)) {
        shape.lineWidth = Math.max(1, Math.min(20, parseInt(newWidth)));
    }
    
    if (shape.type === 'rect') {
        const newWidth = prompt('輸入新寬度', Math.round(shape.width));
        if (newWidth && !isNaN(newWidth)) shape.width = parseFloat(newWidth);
        
        const newHeight = prompt('輸入新高度', Math.round(shape.height));
        if (newHeight && !isNaN(newHeight)) shape.height = parseFloat(newHeight);
    } else if (shape.type === 'circle') {
        const newRadius = prompt('輸入新半徑', Math.round(shape.radius));
        if (newRadius && !isNaN(newRadius)) shape.radius = parseFloat(newRadius);
    }
    
    redraw();
    updateShapesList();
}

// 刪除圖形
function deleteShape(index) {
    if (confirm('確定要刪除這個圖形嗎？')) {
        shapes.splice(index, 1);
        redraw();
        updateShapesList();
    }
}

// 清空畫布
clearBtn.addEventListener('click', () => {
    if (confirm('確定要清空所有圖形嗎？（背景圖片不會被刪除）')) {
        shapes = [];
        selectedShapesForMerge = [];
        redraw();
        updateShapesList();
    }
});

// 合併矩形模式
let isMergeMode = false;

mergeBtn.addEventListener('click', () => {
    isMergeMode = true;
    selectedShapesForMerge = [];
    mergeBtn.style.display = 'none';
    cancelMergeBtn.style.display = 'inline-flex';
    alert('合併模式：請在圖形列表中勾選要合併的矩形，然後點擊「執行合併」按鈕');
    updateShapesList();
});

cancelMergeBtn.addEventListener('click', () => {
    isMergeMode = false;
    selectedShapesForMerge = [];
    mergeBtn.style.display = 'inline-flex';
    cancelMergeBtn.style.display = 'none';
    updateShapesList();
    redraw();
});

// 執行合併
function executeMerge() {
    if (selectedShapesForMerge.length < 2) {
        alert('請至少選擇2個矩形來合併！');
        return;
    }
    
    // 找出選中矩形的邊界
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    selectedShapesForMerge.forEach(idx => {
        const shape = shapes[idx];
        minX = Math.min(minX, shape.x);
        minY = Math.min(minY, shape.y);
        maxX = Math.max(maxX, shape.x + shape.width);
        maxY = Math.max(maxY, shape.y + shape.height);
    });
    
    // 創建新的合併矩形
    const mergedRect = {
        type: 'rect',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        color: '#00ff00',
        lineWidth: 2,
        area: (maxX - minX) * (maxY - minY)
    };
    
    // 移除被合併的矩形（從後往前刪除）
    selectedShapesForMerge.sort((a, b) => b - a);
    selectedShapesForMerge.forEach(idx => {
        shapes.splice(idx, 1);
    });
    
    // 添加合併後的矩形
    shapes.push(mergedRect);
    
    // 重置狀態
    isMergeMode = false;
    selectedShapesForMerge = [];
    mergeBtn.style.display = 'inline-flex';
    cancelMergeBtn.style.display = 'none';
    
    redraw();
    updateShapesList();
    
    alert(`已合併 ${selectedShapesForMerge.length + 1} 個矩形！`);
}

// 切換矩形選擇（用於合併）
function toggleShapeForMerge(index) {
    const idx = selectedShapesForMerge.indexOf(index);
    if (idx > -1) {
        selectedShapesForMerge.splice(idx, 1);
    } else {
        selectedShapesForMerge.push(index);
    }
    updateShapesList();
    redraw();
}

// 下載圖片
downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'drawing_' + new Date().getTime() + '.png';
    link.href = canvas.toDataURL();
    link.click();
});

// 下載 JSON
downloadJSONBtn.addEventListener('click', () => {
    const data = {
        shapes: shapes,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'shapes_' + new Date().getTime() + '.json';
    link.href = URL.createObjectURL(blob);
    link.click();
});

// 初始化
redraw();
