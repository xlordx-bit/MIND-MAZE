document.addEventListener('DOMContentLoaded', () => {
    const startArea = document.getElementById('start-area');
    const startGameBtn = document.getElementById('start-game');
    const questionArea = document.getElementById('question-area');
    const currentQuestion = document.getElementById('current-question');
    const resultArea = document.getElementById('result-area');
    const learningArea = document.getElementById('learning-area');
    const finalGuess = document.getElementById('final-guess');
    const yesBtn = document.getElementById('yes-btn');
    const noBtn = document.getElementById('no-btn');
    const playAgainBtn = document.getElementById('play-again');
    const retryGameBtn = document.getElementById('retry-game');
    const teachBtn = document.getElementById('teach-btn');
    const skipLearningBtn = document.getElementById('skip-learning');
    const newItemInput = document.getElementById('new-item-input');
    const progressFill = document.querySelector('.progress-fill');
    const currentQuestionNum = document.getElementById('current-question-num');
    const totalQuestions = document.getElementById('total-questions');

    let questionCount = 0;
    const maxQuestions = 8;
    let lastGuess = '';

    function updateProgress() {
        const progress = (questionCount / maxQuestions) * 100;
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        if (currentQuestionNum) {
            currentQuestionNum.textContent = questionCount + 1;
        }
    }

    function showElement(element, animationClass = 'animate__fadeIn') {
        if (!element) return Promise.resolve();
        element.classList.remove('hidden');
        element.classList.add('animate__animated', animationClass);
        return new Promise(resolve => {
            element.addEventListener('animationend', () => resolve(), { once: true });
        });
    }

    function hideElement(element, animationClass = 'animate__fadeOut') {
        if (!element) return Promise.resolve();
        return new Promise(resolve => {
            element.classList.add('animate__animated', animationClass);
            element.addEventListener('animationend', () => {
                element.classList.add('hidden');
                element.classList.remove('animate__animated', animationClass);
                resolve();
            }, { once: true });
        });
    }

    async function startGame() {
        try {
            await hideElement(startArea, 'animate__fadeOut');
            questionArea.classList.remove('hidden');
            await askQuestion();
        } catch (error) {
            console.error('Error:', error);
            showNotification('Failed to start game', 'error');
        }
    }

    async function askQuestion() {
        try {
            const response = await fetch('/ask_question', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get question');
            }

            // Enable buttons for new question
            yesBtn.disabled = false;
            noBtn.disabled = false;

            if (data.question) {
                // Don't hide result area to keep guess visible
                learningArea.classList.add('hidden');
                
                // Update and show question
                currentQuestion.textContent = data.question;
                questionCount++;
                updateProgress();
                
                // Show question area with animation
                questionArea.classList.remove('hidden');
                questionArea.classList.add('animate__animated', 'animate__fadeIn');
                currentQuestion.classList.add('animate__animated', 'animate__fadeInUp');
            } else if (data.guess) {
                // Store the guess
                lastGuess = data.guess;
                
                // Hide question area but keep previous elements visible
                questionArea.classList.add('hidden');
                
                // Show guess with animation
                finalGuess.textContent = lastGuess.charAt(0).toUpperCase() + lastGuess.slice(1) + '! 🎯';
                resultArea.classList.remove('hidden');
                resultArea.classList.add('animate__animated', 'animate__zoomIn');
                
                // Keep the result area visible
                resultArea.style.display = 'block';
                resultArea.style.opacity = '1';
                
                // Add effects
                finalGuess.style.animation = 'glow 2s ease-in-out infinite';
                const crystalBall = document.querySelector('.crystal-ball');
                if (crystalBall) {
                    crystalBall.style.animation = 'float 3s ease-in-out infinite, glow 2s ease-in-out infinite alternate';
                }
            } else if (data.unknown) {
                // Hide question area but keep result area visible
                questionArea.classList.add('hidden');
                learningArea.classList.remove('hidden');
                learningArea.classList.add('animate__animated', 'animate__fadeInUp');
                newItemInput.focus();
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification(error.message || 'Oops! Something went wrong...', 'error');
        }
    }

    async function submitAnswer(answer) {
        try {
            // Disable buttons while processing
            yesBtn.disabled = true;
            noBtn.disabled = true;

            const btn = answer === 'yes' ? yesBtn : noBtn;
            btn.classList.add('animate__animated', 'animate__rubberBand');

            const response = await fetch('/submit_answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: currentQuestion.textContent,
                    answer: answer
                })
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to submit answer');
            }

            // Remove animation and ask next question
            setTimeout(() => {
                btn.classList.remove('animate__animated', 'animate__rubberBand');
                askQuestion();
            }, 500);
        } catch (error) {
            console.error('Error:', error);
            showNotification(error.message || 'Oops! Something went wrong...', 'error');
            // Re-enable buttons on error
            yesBtn.disabled = false;
            noBtn.disabled = false;
        }
    }

    async function learnNewItem(itemName) {
        try {
            teachBtn.disabled = true;
            const response = await fetch('/learn_item', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    item_name: itemName
                })
            });
            
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to learn new item');
            }

            if (data.status === 'success') {
                showNotification('✨ Thank you! I learned about: ' + itemName, 'success');
                setTimeout(() => location.reload(), 2000);
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification(error.message || 'Oops! Something went wrong...', 'error');
            teachBtn.disabled = false;
        }
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type} animate__animated animate__fadeInRight`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.remove('animate__fadeInRight');
            notification.classList.add('animate__fadeOutRight');
            notification.addEventListener('animationend', () => notification.remove());
        }, 3000);
    }

    // Function to retry with same guess
    function retryGame() {
        if (lastGuess) {
            finalGuess.textContent = lastGuess.charAt(0).toUpperCase() + lastGuess.slice(1) + '! 🎯';
            resultArea.classList.remove('hidden');
            questionArea.classList.add('hidden');
            learningArea.classList.add('hidden');
        }
    }

    // Event Listeners
    startGameBtn.addEventListener('click', startGame);
    yesBtn.addEventListener('click', () => submitAnswer('yes'));
    noBtn.addEventListener('click', () => submitAnswer('no'));
    playAgainBtn.addEventListener('click', () => location.reload());
    retryGameBtn.addEventListener('click', retryGame);
    skipLearningBtn.addEventListener('click', () => location.reload());
    
    teachBtn.addEventListener('click', async () => {
        const newItem = newItemInput.value.trim();
        if (newItem) {
            teachBtn.disabled = true;
            try {
                const response = await fetch('/learn_item', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        item_name: newItem
                    })
                });
                const data = await response.json();
                if (response.ok) {
                    showNotification('✨ Thank you! I learned about: ' + newItem, 'success');
                    setTimeout(() => location.reload(), 2000);
                } else {
                    throw new Error(data.error || 'Failed to learn new item');
                }
            } catch (error) {
                console.error('Error:', error);
                showNotification(error.message || 'Oops! Something went wrong...', 'error');
                teachBtn.disabled = false;
            }
        } else {
            newItemInput.classList.add('animate__animated', 'animate__shakeX');
            setTimeout(() => newItemInput.classList.remove('animate__animated', 'animate__shakeX'), 1000);
        }
    });

    newItemInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            teachBtn.click();
        }
    });
});