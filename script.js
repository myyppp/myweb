// PWA Service Worker 注册
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// 应用逻辑
document.addEventListener('DOMContentLoaded', function () {
    // DOM 元素引用
    const elements = {
        rowsTableBody: document.getElementById('rows'),
        addRowButton: document.getElementById('addRowBtn'),
        clearInputsButton: document.getElementById('clearInputsBtn'),
        saveHistoryButton: document.getElementById('saveHistoryBtn'),
        clearHistoryButton: document.getElementById('clearHistoryBtn'),
        totalWeightCell: document.getElementById('totalWeight'),
        totalElementCell: document.getElementById('totalElement'),
        sumWeightDisplay: document.getElementById('sumWeight'),
        sumElementDisplay: document.getElementById('sumElement'),
        sumPercentDisplay: document.getElementById('sumPercent'),
        historyList: document.getElementById('historyList')
    };

    // 常量定义
    const DEFAULT_ROW_COUNT = 3;
    const DECIMAL_PLACES = 4;

    // 数据库配置
    const DB_CONFIG = {
        name: 'iron-calc-db',
        version: 1,
        storeName: 'history'
    };

    // 工具函数
    function formatNumber(num, digits = DECIMAL_PLACES) {
        if (!isFinite(num)) return '0';
        return Number(num).toFixed(digits).replace(/\.0+$/, function (match) {
            return match.replace(/0+$/, '');
        });
    }

    function calculateProduct(weight, percent) {
        const weightValue = parseFloat(weight);
        const percentValue = parseFloat(percent);
        if (isNaN(weightValue) || isNaN(percentValue)) return 0;
        return weightValue * (percentValue / 100);
    }

    // 行渲染和管理
    function createRow(index, weight = '', percent = '') {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="idx">${index + 1}</td>
            <td>
                <div style="display:flex;align-items:center;justify-content:center;">
                    <input type="number" class="cell-input weight" placeholder="重量" step="any" value="${weight}">
                </div>
            </td>
            <td>
                <div style="display:flex;align-items:center;justify-content:center;">
                    <input type="number" class="cell-input percent" placeholder="含量" step="any" value="${percent}"><span class="cell-suffix">%</span>
                </div>
            </td>
            <td class="product">0</td>
            <td>
                <button class="small-btn reset-btn remove-row">X</button>
            </td>
        `;

        // 事件绑定
        const weightInput = row.querySelector('.weight');
        const percentInput = row.querySelector('.percent');
        const productCell = row.querySelector('.product');
        const removeButton = row.querySelector('.remove-row');

        function updateRowCalculation() {
            const product = calculateProduct(weightInput.value, percentInput.value);
            productCell.textContent = formatNumber(product, DECIMAL_PLACES);
            recalculateTotals();
        }

        weightInput.addEventListener('input', updateRowCalculation);
        percentInput.addEventListener('input', updateRowCalculation);
        removeButton.addEventListener('click', function () {
            row.remove();
            refreshRowIndices();
            recalculateTotals();
        });

        elements.rowsTableBody.appendChild(row);
        // 初次计算
        updateRowCalculation();
    }

    function refreshRowIndices() {
        Array.from(elements.rowsTableBody.querySelectorAll('tr .idx')).forEach((cell, index) => {
            cell.textContent = index + 1;
        });
    }

    function recalculateTotals() {
        let totalWeight = 0;
        let totalElement = 0;

        elements.rowsTableBody.querySelectorAll('tr').forEach(row => {
            const weight = parseFloat(row.querySelector('.weight').value || '0');
            const percent = parseFloat(row.querySelector('.percent').value || '0');
            const product = calculateProduct(weight, percent);

            if (!isNaN(weight)) totalWeight += weight;
            if (!isNaN(product)) totalElement += product;
        });

        elements.totalWeightCell.textContent = formatNumber(totalWeight, 0);
        elements.totalElementCell.textContent = formatNumber(totalElement, DECIMAL_PLACES);
        elements.sumWeightDisplay.textContent = formatNumber(totalWeight, 0);
        elements.sumElementDisplay.textContent = formatNumber(totalElement, DECIMAL_PLACES);

        const percentage = totalWeight > 0 ? (totalElement / totalWeight) * 100 : 0;
        elements.sumPercentDisplay.textContent = `${formatNumber(percentage, DECIMAL_PLACES)}%`;
    }

    function addRow(weight = '', percent = '') {
        createRow(elements.rowsTableBody.children.length, weight, percent);
    }

    function clearAllInputs() {
        elements.rowsTableBody.innerHTML = '';
        for (let i = 0; i < DEFAULT_ROW_COUNT; i++) {
            addRow();
        }
        recalculateTotals();
    }

    // 初始化默认行
    clearAllInputs();

    // 事件监听器
    elements.addRowButton.addEventListener('click', () => addRow());
    elements.clearInputsButton.addEventListener('click', clearAllInputs);

    // IndexedDB 数据库操作
    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);
            request.onupgradeneeded = function (event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(DB_CONFIG.storeName)) {
                    db.createObjectStore(DB_CONFIG.storeName, { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function addToDatabase(record) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(DB_CONFIG.storeName, 'readwrite');
            transaction.objectStore(DB_CONFIG.storeName).add(record);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async function getAllFromDatabase() {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(DB_CONFIG.storeName, 'readonly');
            const request = transaction.objectStore(DB_CONFIG.storeName).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async function deleteFromDatabase(id) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(DB_CONFIG.storeName, 'readwrite');
            transaction.objectStore(DB_CONFIG.storeName).delete(id);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async function clearDatabase() {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(DB_CONFIG.storeName, 'readwrite');
            transaction.objectStore(DB_CONFIG.storeName).clear();
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // 数据收集和加载
    function collectCurrentRows() {
        const rows = [];
        elements.rowsTableBody.querySelectorAll('tr').forEach(row => {
            const weight = parseFloat(row.querySelector('.weight').value || '0');
            const percent = parseFloat(row.querySelector('.percent').value || '0');
            rows.push({
                weight: isNaN(weight) ? 0 : weight,
                percent: isNaN(percent) ? 0 : percent
            });
        });
        return rows;
    }

    function loadRowsIntoTable(rows) {
        elements.rowsTableBody.innerHTML = '';
        rows.forEach(row => addRow(row.weight, row.percent));
        if (rows.length === 0) {
            for (let i = 0; i < DEFAULT_ROW_COUNT; i++) {
                addRow();
            }
        }
        recalculateTotals();
    }

    // 历史记录渲染
    async function renderHistoryRecords() {
        const records = await getAllFromDatabase();
        elements.historyList.innerHTML = '';

        records.sort((a, b) => b.id - a.id).forEach(record => {
            const listItem = document.createElement('li');
            listItem.className = 'history-item';

            const timestamp = new Date(record.timestamp).toLocaleString();
            const percentage = record.totalWeight > 0 ? (record.totalElement / record.totalWeight) * 100 : 0;

            // 构建详细数据表格
            let detailTable = `
                <table class="history-detail-table">
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>铁水重量</th>
                            <th>单元素含量</th>
                            <th>重量×含量</th>
                        </tr>
                    </thead>
                    <tbody>`;

            record.rows.forEach((row, index) => {
                const product = calculateProduct(row.weight, row.percent);
                detailTable += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${formatNumber(row.weight, 2)}</td>
                        <td>${formatNumber(row.percent, DECIMAL_PLACES)}%</td>
                        <td>${formatNumber(product, DECIMAL_PLACES)}</td>
                    </tr>`;
            });
            detailTable += '</tbody></table>';

            listItem.innerHTML = `
                <div class="history-content">
                    <div class="history-summary">
                        <strong>${timestamp}</strong>
                        <div class="summary-stats">
                            总重: ${formatNumber(record.totalWeight, 0)} |
                            元素量: ${formatNumber(record.totalElement, DECIMAL_PLACES)} |
                            占比: ${formatNumber(percentage, DECIMAL_PLACES)}%
                        </div>
                    </div>
                    <div class="history-details">
                        ${detailTable}
                    </div>
                </div>
                <div class="history-actions">
                    <button class="small-btn calculate-btn restore">还原</button>
                    <button class="small-btn reset-btn del">删除</button>
                </div>
            `;

            // 按钮事件绑定
            listItem.querySelector('.restore').addEventListener('click', () => {
                if (confirm('确认要恢复到这个历史记录吗？当前输入的数据将被覆盖。')) {
                    loadRowsIntoTable(record.rows);
                }
            });

            listItem.querySelector('.del').addEventListener('click', async () => {
                if (confirm('确认要删除这条历史记录吗？')) {
                    await deleteFromDatabase(record.id);
                    renderHistoryRecords();
                }
            });

            elements.historyList.appendChild(listItem);
        });
    }

    // 历史记录操作
    elements.saveHistoryButton.addEventListener('click', async () => {
        const rows = collectCurrentRows();
        let totalWeight = 0, totalElement = 0;
        rows.forEach(row => {
            totalWeight += row.weight;
            totalElement += calculateProduct(row.weight, row.percent);
        });

        const record = {
            timestamp: Date.now(),
            rows,
            totalWeight: totalWeight,
            totalElement: totalElement
        };

        await addToDatabase(record);
        await renderHistoryRecords();
        alert('已保存到历史');
    });

    elements.clearHistoryButton.addEventListener('click', async () => {
        if (!confirm('确认清空所有历史记录？')) return;
        await clearDatabase();
        await renderHistoryRecords();
    });

    // 首次渲染历史记录
    renderHistoryRecords();
});
