import { registerServiceWorker } from './service-worker.js';
import { setupInstallPrompt } from './install-prompt.js';
import { handleAuth, setupLogout } from './auth.js';
import { loadTasks } from './tasks.js';
import { setupUI } from './ui.js';

document.addEventListener('DOMContentLoaded', async function() {
    console.log("App initializing...");
    try {
        registerServiceWorker();
        setupInstallPrompt();

        const authData = handleAuth();
        if (!authData) {
            console.log("Authentication failed, stopping initialization");
            return;
        }

        const { username, encodedUsername } = authData;
        console.log("Setting up UI and logout for user:", username);
        setupLogout();

        const { toggleAddTaskForm, toggleEditForm, toggleSettingsPanel, showCelebration, renderTasks } = setupUI(encodedUsername, username, animateAddTask);

        console.log("Loading tasks...");
        await loadTasks(encodedUsername, renderTasks);
        console.log("App initialization complete");

        // Focus Mode Button
        const focusModeBtn = document.getElementById('focus-mode-btn');
        if (focusModeBtn) {
            focusModeBtn.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default anchor navigation
                console.log("Entering Focus Mode...");
                const modal = document.createElement('div');
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.width = '100%';
                modal.style.height = '100%';
                modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                modal.style.display = 'flex';
                modal.style.alignItems = 'center';
                modal.style.justifyContent = 'center';
                modal.style.zIndex = '1000';
                modal.style.animation = 'fadeOut 2s ease-in-out forwards';
                modal.innerHTML = `
                    <div style="
                        background-color: #FFFFFF;
                        padding: 1.5rem;
                        border-radius: 8px;
                        text-align: center;
                        max-width: 300px;
                        color: #1F2937;
                        font-size: 0.875rem;
                        font-weight: 500;
                    ">
                        You’re about to enter Focus Mode — all distractions will be left behind.
                    </div>
                `;
                document.body.appendChild(modal);

                // Define fadeOut animation
                const styleSheet = document.createElement('style');
                styleSheet.innerHTML = `
                    @keyframes fadeOut {
                        0% { opacity: 1; }
                        80% { opacity: 1; }
                        100% { opacity: 0; }
                    }
                `;
                document.head.appendChild(styleSheet);

                localStorage.setItem('focus_session', new Date().getTime().toString());
                setTimeout(() => {
                    modal.remove();
                    window.location.href = '/tools/dailish/focus.html';
                }, 2000);
            });
        }
    } catch (error) {
        console.error("Error during app initialization:", error);
        alert("Failed to initialize app. Please try again.");
    }

    function animateAddTask() {
        console.log("Animating add task button...");
        const addTaskBtn = document.getElementById('add-task-btn');
        if (addTaskBtn) {
            addTaskBtn.style.animation = 'glow 1s ease';
            setTimeout(() => {
                addTaskBtn.style.animation = '';
            }, 1000);
        } else {
            console.error("Add task button not found");
        }
    }
});