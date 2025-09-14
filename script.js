document.addEventListener('DOMContentLoaded', () => {
    // --- HTML要素の取得 ---
    const canvas = document.getElementById('reactionCanvas');
    const ctx = canvas.getContext('2d');
    const slider = document.getElementById('baseSlider');
    const startButton = document.getElementById('startButton');
    const resetButton = document.getElementById('resetButton');
    const timeDisplay = document.getElementById('timeDisplay');
    const yieldDisplay = document.getElementById('yieldDisplay');

    // --- シミュレーション定数と変数 ---
    let simTime = 0;
    const timeStep = 0.1; // 1フレームあたりの時間経過
    const maxTime = 100; // シミュレーションの最大時間
    let animationFrameId;

    // 濃度 [mol/L]
    let concentrations = {
        EtA: 1.0,  // 酢酸エチル (原料)
        Enol: 0.0, // エノラート (中間体)
        Prod: 0.0  // アセト酢酸エチル (生成物)
    };
    const initialConcentration = concentrations.EtA;

    // 反応速度定数
    const k_rev = 1.5;  // エノラート生成の逆反応
    const k_couple = 1.0; // カップリング反応

    // --- グラフの初期設定 ---
    const chartCanvas = document.getElementById('concentrationChart');
    const concentrationChart = new Chart(chartCanvas, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: '酢酸エチル', borderColor: '#3498db', data: [], fill: false, tension: 0.1 },
                { label: 'エノラート', borderColor: '#e74c3c', data: [], fill: false, tension: 0.1 },
                { label: 'アセト酢酸エチル', borderColor: '#2ecc71', data: [], fill: false, tension: 0.1 }
            ]
        },
        options: {
            scales: { y: { beginAtZero: true, max: 1.1, title: { display: true, text: '濃度 (mol/L)' } } },
            animation: { duration: 0 } // アニメーションをオフにして軽くする
        }
    });

    // --- メインのシミュレーション関数 ---
    function runSimulation() {
        if (simTime >= maxTime) {
            stopSimulation();
            return;
        }

        // 1. 速度定数をスライダーから取得
        const k_fwd = parseFloat(slider.value);

        // 2. 反応速度の計算
        const rate_enol_formation = k_fwd * concentrations.EtA;
        const rate_enol_reverse = k_rev * concentrations.Enol;
        const rate_coupling = k_couple * concentrations.Enol * concentrations.EtA;

        // 3. 濃度の変化量を計算
        const delta_EtA = (-rate_enol_formation + rate_enol_reverse - rate_coupling) * timeStep;
        const delta_Enol = (rate_enol_formation - rate_enol_reverse - rate_coupling) * timeStep;
        const delta_Prod = (rate_coupling) * timeStep;

        // 4. 濃度を更新 (0未満にならないように)
        concentrations.EtA = Math.max(0, concentrations.EtA + delta_EtA);
        concentrations.Enol = Math.max(0, concentrations.Enol + delta_Enol);
        concentrations.Prod = Math.max(0, concentrations.Prod + delta_Prod);

        // 5. 時間を更新
        simTime += timeStep;

        // 6. 描画
        updateDisplay();
        drawMolecules();
        updateChart();

        // 次のフレームを予約
        animationFrameId = requestAnimationFrame(runSimulation);
    }

    // --- 画面表示の更新 ---
    function updateDisplay() {
        timeDisplay.textContent = simTime.toFixed(1);
        const yieldPercent = (concentrations.Prod * 2 / initialConcentration) * 100;
        yieldDisplay.textContent = yieldPercent.toFixed(1);
    }

    // --- グラフの更新 ---
    function updateChart() {
        // グラフの更新頻度を少し落として負荷を軽減
        if (Math.floor(simTime * 10) % 5 === 0) {
            concentrationChart.data.labels.push(simTime.toFixed(1));
            concentrationChart.data.datasets[0].data.push(concentrations.EtA);
            concentrationChart.data.datasets[1].data.push(concentrations.Enol);
            concentrationChart.data.datasets[2].data.push(concentrations.Prod);
            concentrationChart.update();
        }
    }
    
    
    // --- キャンバスへの分子描画 ---
    // (これはあくまでイメージです。正確な分子動力学ではありません)
    const molecules = [];
    const totalMolecules = 200;
    function drawMolecules() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 毎回再計算するのは重いので、一定間隔で更新
        if (molecules.length === 0 || Math.floor(simTime) % 5 === 0) {
            molecules.length = 0; // 配列をクリア
            const numEtA = Math.round(totalMolecules * (concentrations.EtA / initialConcentration));
            const numEnol = Math.round(totalMolecules * (concentrations.Enol / initialConcentration));
            const numProd = Math.round(totalMolecules * (concentrations.Prod / initialConcentration));
            
            for (let i = 0; i < numEtA; i++) createMolecule('EtA');
            for (let i = 0; i < numEnol; i++) createMolecule('Enol');
            for (let i = 0; i < numProd; i++) createMolecule('Prod');
        }

        molecules.forEach(mol => {
            // 簡単な動き
            mol.x += mol.vx;
            mol.y += mol.vy;
            if (mol.x < 0 || mol.x > canvas.width) mol.vx *= -1;
            if (mol.y < 0 || mol.y > canvas.height) mol.vy *= -1;

            ctx.beginPath();
            ctx.arc(mol.x, mol.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = mol.color;
            ctx.fill();
        });
    }
    
    function createMolecule(type) {
         let color = '#3498db'; // EtA
         if (type === 'Enol') color = '#e74c3c';
         if (type === 'Prod') color = '#2ecc71';
         
         molecules.push({
             x: Math.random() * canvas.width,
             y: Math.random() * canvas.height,
             vx: (Math.random() - 0.5) * 2,
             vy: (Math.random() - 0.5) * 2,
             color: color
         });
    }

    // --- シミュレーション制御 ---
    function startSimulation() {
        stopSimulation(); // 既に動いていたら止める
        resetSimulation(); // 状態をリセット
        animationFrameId = requestAnimationFrame(runSimulation);
        startButton.disabled = true;
        slider.disabled = true; // ★追加: シミュレーション中はスライダーを無効化
    }

    function stopSimulation() {
        cancelAnimationFrame(animationFrameId);
        startButton.disabled = false;
        slider.disabled = false; // ★追加: スライダーを有効化
    }

    function resetSimulation() {
        stopSimulation();
        simTime = 0;
        concentrations = { EtA: 1.0, Enol: 0.0, Prod: 0.0 };
        molecules.length = 0;
        
        // グラフをクリア
        concentrationChart.data.labels = [];
        concentrationChart.data.datasets.forEach((dataset) => {
            dataset.data = [];
        });
        concentrationChart.update();
        
        updateDisplay();
        drawMolecules();
    }

    // --- イベントリスナー ---
    startButton.addEventListener('click', startSimulation);
    resetButton.addEventListener('click', resetSimulation);

    // --- 初期状態の描画 ---
    resetSimulation();
});
