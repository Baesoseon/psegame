class PoseMatchingGame {
    constructor() {
        this.detector = null;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.isGameRunning = false;
        this.currentLevel = 1;
        this.totalLevels = 4;
        this.startTime = null;
        this.gameTimer = null;
        this.poseDetectionInterval = null;
        this.levelTimer = null;
        this.levelTimeLeft = 60; // 60초 (1분)
        
        // DOM 요소들
        this.targetImage = document.getElementById('targetImage');
        this.currentLevelSpan = document.getElementById('currentLevel');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.matchPercentage = document.getElementById('matchPercentage');
        this.elapsedTime = document.getElementById('elapsedTime');
        this.levelTimeLeftSpan = document.getElementById('levelTimeLeft');
        this.startBtn = document.getElementById('startBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.gameComplete = document.getElementById('gameComplete');
        this.gameFailed = document.getElementById('gameFailed');
        this.totalTime = document.getElementById('totalTime');
        
        this.initializeEventListeners();
        this.initializePoseDetection();
        this.initializeAIExplanation();
    }
    
    async initializePoseDetection() {
        try {
            // TensorFlow.js 초기화
            await tf.ready();
            
            // PoseNet 모델 로드
            const model = poseDetection.SupportedModels.MoveNet;
            const detectorConfig = {
                modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
            };
            
            this.detector = await poseDetection.createDetector(model, detectorConfig);
            console.log('포즈 감지 모델이 로드되었습니다.');
            
        } catch (error) {
            console.error('포즈 감지 모델 로드 실패:', error);
            alert('포즈 감지 모델을 로드할 수 없습니다. 인터넷 연결을 확인해주세요.');
        }
    }
    
    initializeEventListeners() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.resetBtn.addEventListener('click', () => this.resetGame());
        
        // 실패 화면 버튼 이벤트
        const retryBtn = document.getElementById('retryBtn');
        const restartBtn = document.getElementById('restartBtn');
        
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retryLevel());
        }
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.resetGame());
        }
    }
    
    initializeAIExplanation() {
        // AI 원리 설명 토글 기능
        const explanationTrigger = document.querySelector('.explanation-trigger');
        const explanationContent = document.querySelector('.explanation-content');
        
        if (explanationTrigger && explanationContent) {
            explanationTrigger.addEventListener('click', () => {
                explanationContent.classList.toggle('hidden');
                
                // 버튼 텍스트 변경
                const triggerText = explanationTrigger.querySelector('.trigger-text');
                if (explanationContent.classList.contains('hidden')) {
                    triggerText.textContent = 'AI 원리 알아보기';
                } else {
                    triggerText.textContent = 'AI 원리 숨기기';
                }
            });
        }
    }
    
    async startGame() {
        if (this.isGameRunning) return;
        
        try {
            // 웹캠 접근
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: 640, 
                    height: 480,
                    facingMode: 'user'
                } 
            });
            
            this.video = document.getElementById('webcam');
            this.canvas = document.getElementById('poseCanvas');
            this.ctx = this.canvas.getContext('2d');
            
            this.video.srcObject = stream;
            this.video.onloadedmetadata = () => {
                this.video.play();
                this.isGameRunning = true;
                this.startTime = Date.now();
                this.startBtn.textContent = '게임 진행 중...';
                this.startBtn.disabled = true;
                
                // 게임 타이머 시작
                this.startGameTimer();
                
                // 레벨 타이머 시작
                this.startLevelTimer();
                
                // 포즈 감지 시작
                this.startPoseDetection();
            };
            
        } catch (error) {
            console.error('웹캠 접근 실패:', error);
            alert('웹캠에 접근할 수 없습니다. 웹캠 권한을 확인해주세요.');
        }
    }
    
    startGameTimer() {
        this.gameTimer = setInterval(() => {
            if (this.startTime) {
                const elapsed = Date.now() - this.startTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                this.elapsedTime.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
    
    startLevelTimer() {
        this.levelTimeLeft = 60; // 1분으로 초기화
        this.updateLevelTimeDisplay();
        
        this.levelTimer = setInterval(() => {
            this.levelTimeLeft--;
            this.updateLevelTimeDisplay();
            
            // 시간이 다 되면 실패
            if (this.levelTimeLeft <= 0) {
                this.levelFailed();
            }
        }, 1000);
    }
    
    updateLevelTimeDisplay() {
        const minutes = Math.floor(this.levelTimeLeft / 60);
        const seconds = this.levelTimeLeft % 60;
        this.levelTimeLeftSpan.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    startPoseDetection() {
        this.poseDetectionInterval = setInterval(async () => {
            if (this.isGameRunning && this.detector) {
                await this.detectPose();
            }
        }, 100); // 100ms마다 포즈 감지
    }
    
    async detectPose() {
        try {
            const poses = await this.detector.estimatePoses(this.video);
            
            if (poses.length > 0) {
                const pose = poses[0];
                this.drawPose(pose);
                this.calculatePoseSimilarity(pose);
            }
        } catch (error) {
            console.error('포즈 감지 오류:', error);
        }
    }
    
    drawPose(pose) {
        // 캔버스 초기화
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 포즈 키포인트 그리기
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = '#ff0000';
        
        // 키포인트 연결선 그리기
        const connections = [
            ['nose', 'left_eye'], ['nose', 'right_eye'],
            ['left_eye', 'left_ear'], ['right_eye', 'right_ear'],
            ['left_shoulder', 'right_shoulder'],
            ['left_shoulder', 'left_elbow'], ['right_shoulder', 'right_elbow'],
            ['left_elbow', 'left_wrist'], ['right_elbow', 'right_wrist'],
            ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
            ['left_hip', 'right_hip'],
            ['left_hip', 'left_knee'], ['right_hip', 'right_knee'],
            ['left_knee', 'left_ankle'], ['right_knee', 'right_ankle']
        ];
        
        connections.forEach(([start, end]) => {
            const startPoint = pose.keypoints.find(kp => kp.name === start);
            const endPoint = pose.keypoints.find(kp => kp.name === end);
            
            if (startPoint && endPoint && startPoint.score > 0.3 && endPoint.score > 0.3) {
                this.ctx.beginPath();
                this.ctx.moveTo(startPoint.x, startPoint.y);
                this.ctx.lineTo(endPoint.x, endPoint.y);
                this.ctx.stroke();
            }
        });
        
        // 키포인트 그리기
        pose.keypoints.forEach(keypoint => {
            if (keypoint.score > 0.3) {
                this.ctx.beginPath();
                this.ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
                this.ctx.fill();
            }
        });
    }
    
    calculatePoseSimilarity(userPose) {
        // 간단한 포즈 유사도 계산 (실제로는 더 정교한 알고리즘이 필요)
        let totalScore = 0;
        let validKeypoints = 0;
        
        // 주요 키포인트들의 상대적 위치 비교
        const keypoints = ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'];
        
        keypoints.forEach(name => {
            const keypoint = userPose.keypoints.find(kp => kp.name === name);
            if (keypoint && keypoint.score > 0.3) {
                totalScore += keypoint.score;
                validKeypoints++;
            }
        });
        
        if (validKeypoints > 0) {
            const similarity = (totalScore / validKeypoints) * 100;
            this.updateProgress(similarity);
            
            // 80% 이상이면 다음 레벨로
            if (similarity >= 80) {
                this.nextLevel();
            }
        }
    }
    
    updateProgress(percentage) {
        const clampedPercentage = Math.min(100, Math.max(0, percentage));
        
        this.progressFill.style.width = `${clampedPercentage}%`;
        this.progressText.textContent = `${Math.round(clampedPercentage)}%`;
        this.matchPercentage.textContent = `일치도: ${Math.round(clampedPercentage)}%`;
        
        // 진행률에 따른 색상 변경
        if (clampedPercentage >= 80) {
            this.progressFill.style.background = 'linear-gradient(90deg, #48bb78, #38a169)';
        } else if (clampedPercentage >= 60) {
            this.progressFill.style.background = 'linear-gradient(90deg, #ed8936, #dd6b20)';
        } else {
            this.progressFill.style.background = 'linear-gradient(90deg, #f56565, #e53e3e)';
        }
    }
    
    nextLevel() {
        if (this.currentLevel < this.totalLevels) {
            this.currentLevel++;
            this.currentLevelSpan.textContent = this.currentLevel;
            this.targetImage.src = `images/${this.currentLevel}.jpg`;
            
            // 진행률 초기화
            this.updateProgress(0);
            
            // 레벨 타이머 재시작
            this.resetLevelTimer();
            this.startLevelTimer();
            
            // 다음 레벨 알림
            setTimeout(() => {
                alert(`레벨 ${this.currentLevel - 1} 완성! 다음 레벨로 진행합니다.`);
            }, 500);
            
        } else {
            this.completeGame();
        }
    }
    
    completeGame() {
        this.isGameRunning = false;
        clearInterval(this.gameTimer);
        clearInterval(this.poseDetectionInterval);
        this.resetLevelTimer();
        
        const totalTime = Date.now() - this.startTime;
        const minutes = Math.floor(totalTime / 60000);
        const seconds = Math.floor((totalTime % 60000) / 1000);
        
        this.totalTime.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        this.gameComplete.classList.remove('hidden');
        this.startBtn.textContent = '게임 완성!';
        
        // 웹캠 정지
        if (this.video && this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
        }
    }
    
    levelFailed() {
        this.isGameRunning = false;
        clearInterval(this.gameTimer);
        clearInterval(this.poseDetectionInterval);
        this.resetLevelTimer();
        
        // 실패 화면 표시
        this.gameFailed.classList.remove('hidden');
        this.startBtn.textContent = '게임 실패';
        this.startBtn.disabled = true;
        
        // 웹캠 정지
        if (this.video && this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
        }
    }
    
    retryLevel() {
        // 실패 화면 숨기기
        this.gameFailed.classList.add('hidden');
        
        // 현재 레벨 다시 시작
        this.isGameRunning = true;
        this.startBtn.textContent = '게임 진행 중...';
        this.startBtn.disabled = true;
        
        // 진행률 초기화
        this.updateProgress(0);
        
        // 웹캠 재시작
        this.startGame();
    }
    
    resetLevelTimer() {
        if (this.levelTimer) {
            clearInterval(this.levelTimer);
            this.levelTimer = null;
        }
        this.levelTimeLeft = 60;
        this.updateLevelTimeDisplay();
    }
    
    resetGame() {
        this.isGameRunning = false;
        this.currentLevel = 1;
        this.currentLevelSpan.textContent = this.currentLevel;
        this.targetImage.src = 'images/1.jpg';
        
        // 진행률 초기화
        this.updateProgress(0);
        
        // 타이머 초기화
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        if (this.poseDetectionInterval) {
            clearInterval(this.poseDetectionInterval);
        }
        this.resetLevelTimer();
        
        this.startTime = null;
        this.elapsedTime.textContent = '00:00';
        
        // 버튼 상태 초기화
        this.startBtn.textContent = '게임 시작';
        this.startBtn.disabled = false;
        
        // 게임 완성 메시지 숨기기
        this.gameComplete.classList.add('hidden');
        
        // 게임 실패 메시지 숨기기
        this.gameFailed.classList.add('hidden');
        
        // AI 원리 설명 숨기기
        const explanationContent = document.querySelector('.explanation-content');
        if (explanationContent) {
            explanationContent.classList.add('hidden');
        }
        
        // AI 원리 버튼 텍스트 초기화
        const triggerText = document.querySelector('.trigger-text');
        if (triggerText) {
            triggerText.textContent = 'AI 원리 알아보기';
        }
        
        // 웹캠 정지
        if (this.video && this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
        }
        
        // 캔버스 초기화
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}

// 게임 초기화
document.addEventListener('DOMContentLoaded', () => {
    new PoseMatchingGame();
});
