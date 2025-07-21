import { db, doc, getDoc, setDoc, deleteDoc } from './firebase.js';

// Debug: Pastikan deleteDoc terimpor
console.log("deleteDoc imported:", deleteDoc);

export function setupLogin() {
    const landingButtons = document.getElementById('landing-buttons');
    const createUsernameForm = document.getElementById('create-username-form');
    const viewUsernameForm = document.getElementById('view-username-form');
    const deleteAccountForm = document.getElementById('delete-account-form');
    const deleteConfirmPopup = document.getElementById('delete-confirm-popup');
    
    const createListBtn = document.getElementById('create-list-btn');
    const viewListBtn = document.getElementById('view-list-btn');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const saveUsernameBtn = document.getElementById('save-username-btn');
    const cancelUsernameBtn = document.getElementById('cancel-username-btn');
    const loadTasksBtn = document.getElementById('load-tasks-btn');
    const cancelViewBtn = document.getElementById('cancel-view-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const finalDeleteBtn = document.getElementById('final-delete-btn');
    const cancelConfirmDeleteBtn = document.getElementById('cancel-confirm-delete-btn');
    
    const newUsernameInput = document.getElementById('new-username');
    const newPinInput = document.getElementById('new-pin');
    const existingUsernameInput = document.getElementById('existing-username');
    const existingPinInput = document.getElementById('existing-pin');
    const deleteUsernameInput = document.getElementById('delete-username');
    const deletePinInput = document.getElementById('delete-pin');
    const pinGroup = document.getElementById('pin-group');
    const deletePinGroup = document.getElementById('delete-pin-group');
    const recentTasks = document.getElementById('recent-tasks');

    function encodeUsername(username) {
        return btoa(encodeURIComponent(username));
    }

    function applySavedTheme() {
        const savedTheme = localStorage.getItem('todo_theme');
        if (savedTheme) {
            console.log("Applying saved theme:", savedTheme);
            document.body.className = savedTheme === 'light' ? '' : `${savedTheme}-mode`;
        }
    }

    applySavedTheme();

    createListBtn.addEventListener('click', function() {
        landingButtons.style.display = 'none';
        createUsernameForm.classList.add('visible');
        newUsernameInput.focus();
    });

    viewListBtn.addEventListener('click', function() {
        landingButtons.style.display = 'none';
        viewUsernameForm.classList.add('visible');
        existingUsernameInput.focus();
    });

    deleteAccountBtn.addEventListener('click', function() {
        landingButtons.style.display = 'none';
        deleteAccountForm.classList.add('visible');
        deleteUsernameInput.focus();
    });

    function resetForms() {
        landingButtons.style.display = 'flex';
        createUsernameForm.classList.remove('visible');
        viewUsernameForm.classList.remove('visible');
        deleteAccountForm.classList.remove('visible');
        deleteConfirmPopup.style.display = 'none';
        newUsernameInput.value = '';
        newPinInput.value = '';
        existingUsernameInput.value = '';
        existingPinInput.value = '';
        deleteUsernameInput.value = '';
        deletePinInput.value = '';
        pinGroup.style.display = 'none';
        deletePinGroup.style.display = 'none';
    }

    cancelUsernameBtn.addEventListener('click', resetForms);
    cancelViewBtn.addEventListener('click', resetForms);
    cancelDeleteBtn.addEventListener('click', resetForms);
    cancelConfirmDeleteBtn.addEventListener('click', resetForms);

    // Toggle PIN visibility
    document.querySelectorAll('.toggle-pin-visibility').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const input = document.getElementById(targetId);
            if (input.type === 'password') {
                input.type = 'text';
                button.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                input.type = 'password';
                button.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    });

    saveUsernameBtn.addEventListener('click', async function() {
        const username = newUsernameInput.value.trim();
        const pin = newPinInput.value.trim();
        if (!username) {
            alert('Please enter a username');
            return;
        }
        if (pin && !/^\d{4}$/.test(pin)) {
            alert('PIN must be 4 digits');
            return;
        }

        try {
            const encodedUsername = encodeUsername(username);
            const userDocRef = doc(db, "users", encodedUsername);
            
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                alert('Username already exists. Please choose another or view your existing list.');
                return;
            }

            await setDoc(userDocRef, {
                tasks: [],
                createdAt: new Date(),
                pin: pin || null
            });

            sessionStorage.setItem('todo_username', encodedUsername);
            localStorage.setItem('todo_username_fallback', encodedUsername);
            window.location.href = '/tools/dailish/app.html';
        } catch (error) {
            console.error("Error creating user: ", error);
            alert('An error occurred. Please try again.');
        }
    });

    existingUsernameInput.addEventListener('input', async () => {
        const username = existingUsernameInput.value.trim();
        if (username) {
            try {
                const encodedUsername = encodeUsername(username);
                const userDocRef = doc(db, "users", encodedUsername);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists() && userDoc.data().pin) {
                    pinGroup.style.display = 'block';
                } else {
                    pinGroup.style.display = 'none';
                }
            } catch (error) {
                console.error("Error checking PIN:", error);
            }
        } else {
            pinGroup.style.display = 'none';
        }
    });

    loadTasksBtn.addEventListener('click', async function() {
        const username = existingUsernameInput.value.trim();
        const pin = existingPinInput.value.trim();
        if (!username) {
            alert('Please enter your username');
            return;
        }

        try {
            const encodedUsername = encodeUsername(username);
            const userDocRef = doc(db, "users", encodedUsername);
            
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
                alert('Username not found. Please check your username or create a new list.');
                return;
            }

            const userData = userDoc.data();
            if (userData.pin && userData.pin !== pin) {
                alert('Incorrect PIN. Please try again.');
                return;
            }

            sessionStorage.setItem('todo_username', encodedUsername);
            localStorage.setItem('todo_username_fallback', encodedUsername);
            window.location.href = '/tools/dailish/app.html';
        } catch (error) {
            console.error("Error loading user: ", error);
            alert('An error occurred. Please try again.');
        }
    });

    deleteUsernameInput.addEventListener('input', async () => {
        const username = deleteUsernameInput.value.trim();
        if (username) {
            try {
                const encodedUsername = encodeUsername(username);
                const userDocRef = doc(db, "users", encodedUsername);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists() && userDoc.data().pin) {
                    deletePinGroup.style.display = 'block';
                } else {
                    deletePinGroup.style.display = 'none';
                }
            } catch (error) {
                console.error("Error checking PIN for delete:", error);
            }
        } else {
            deletePinGroup.style.display = 'none';
        }
    });

    confirmDeleteBtn.addEventListener('click', async () => {
        const username = deleteUsernameInput.value.trim();
        const pin = deletePinInput.value.trim();
        if (!username) {
            alert('Please enter your username');
            return;
        }

        try {
            const encodedUsername = encodeUsername(username);
            const userDocRef = doc(db, "users", encodedUsername);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                alert('Username not found.');
                return;
            }

            const userData = userDoc.data();
            if (userData.pin && userData.pin !== pin) {
                alert('Incorrect PIN. Please try again.');
                return;
            }

            // Show recent tasks in popup
            const tasks = userData.tasks || [];
            recentTasks.innerHTML = '<strong>Recent Tasks:</strong><ul>' + 
                tasks.slice(0, 5).map(task => `<li>${task.title}</li>`).join('') + 
                '</ul>';
            if (tasks.length === 0) {
                recentTasks.innerHTML = '<p>No tasks found.</p>';
            }

            deleteAccountForm.classList.remove('visible');
            deleteConfirmPopup.style.display = 'flex';
        } catch (error) {
            console.error("Error verifying user for deletion:", error);
            alert('An error occurred. Please try again.');
        }
    });

    finalDeleteBtn.addEventListener('click', async () => {
        const username = deleteUsernameInput.value.trim();
        try {
            const encodedUsername = encodeUsername(username);
            const userDocRef = doc(db, "users", encodedUsername);
            await deleteDoc(userDocRef);

            localStorage.removeItem(`tasks_${encodedUsername}`);
            localStorage.removeItem('todo_username');
            localStorage.removeItem('todo_username_fallback');
            localStorage.removeItem('todo_theme');

            alert('Your account has been deleted.');
            resetForms();
        } catch (error) {
            console.error("Error deleting account:", error);
            alert('Failed to delete account. Please try again.');
        }
    });

    newUsernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveUsernameBtn.click();
        }
    });

    existingUsernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadTasksBtn.click();
        }
    });

    deleteUsernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            confirmDeleteBtn.click();
        }
    });
}