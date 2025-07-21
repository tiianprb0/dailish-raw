import { db, doc, getDoc, updateDoc, arrayUnion } from './firebase.js';
import { formatDate, isOverdue } from './utils.js';

let tasks = [];
let allCategories = [];
let currentEditingTask = null;
let currentFilter = 'active';
let currentSort = 'filter';
let currentActiveSort = 'default';
let currentSearch = '';

const availableIcons = {
    'fa-tag': 'Tag',
    'fa-briefcase': 'Work',
    'fa-user': 'Personal',
    'fa-umbrella-beach': 'Holiday',
    'fa-graduation-cap': 'School',
    'fa-home': 'Home',
    'fa-shopping-cart': 'Shopping',
    'fa-heartbeat': 'Health'
};

export async function loadTasks(encodedUsername, renderTasksCallback) {
    console.log("Attempting to load tasks for user:", encodedUsername);
    const taskList = document.getElementById('task-list');
    const emptyState = document.getElementById('empty-state');

    if (!taskList || !emptyState) {
        console.error("Task list or empty state element not found in DOM");
        return;
    }

    try {
        const userDocRef = doc(db, "users", encodedUsername);
        console.log("Fetching document from Firestore...");
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            tasks = docSnap.data().tasks || [];
            console.log("Tasks fetched from Firestore:", tasks);
            localStorage.setItem(`tasks_${encodedUsername}`, JSON.stringify(tasks));
        } else {
            console.log("No tasks document found in Firestore, initializing empty tasks");
            tasks = [];
        }

        if (!navigator.onLine) {
            console.log("Offline mode detected, checking cache...");
            const cachedTasks = localStorage.getItem(`tasks_${encodedUsername}`);
            if (cachedTasks) {
                tasks = JSON.parse(cachedTasks);
                console.log("Loaded tasks from cache:", tasks);
            } else {
                console.log("No cached tasks available");
            }
        }

        allCategories = [...new Set(tasks
            .filter(task => task.category && task.category.trim() !== '')
            .map(task => task.category.trim()))].sort();
        console.log("Categories updated:", allCategories);

        renderTasksCallback(tasks);
    } catch (error) {
        console.error("Error loading tasks from Firestore:", error);
        const cachedTasks = localStorage.getItem(`tasks_${encodedUsername}`);
        if (cachedTasks) {
            tasks = JSON.parse(cachedTasks);
            allCategories = [...new Set(tasks
                .filter(task => task.category && task.category.trim() !== '')
                .map(task => task.category.trim()))].sort();
            console.log("Falling back to cached tasks:", tasks);
            renderTasksCallback(tasks);
            alert('Offline mode: Showing cached tasks.');
        } else {
            console.error("No cached tasks available, rendering empty list");
            renderTasksCallback([]);
            alert('Failed to load tasks and no cache available.');
        }
    }
}

export function renderTasks(tasksToRender, renderOptions = {}, isInitialLoad = false) {
    console.log("Rendering tasks with filter/sort:", renderOptions);
    const { filter = currentFilter, sort = currentSort, activeSort = currentActiveSort, search = currentSearch } = renderOptions;
    const taskList = document.getElementById('task-list');
    const emptyState = document.getElementById('empty-state');

    if (!taskList || !emptyState) {
        console.error("Task list or empty state element not found in DOM");
        return;
    }

    taskList.innerHTML = '';
    let filteredTasks = [...tasksToRender];

    if (search) {
        const searchTerm = search.toLowerCase();
        filteredTasks = filteredTasks.filter(task =>
            task.title.toLowerCase().includes(searchTerm) ||
            (task.brief && task.brief.toLowerCase().includes(searchTerm)) ||
            (task.category && task.category.toLowerCase().includes(searchTerm))
        );
        console.log("Filtered tasks by search:", filteredTasks.length);
    }

    if (filter === 'active') {
        filteredTasks = filteredTasks.filter(task => !task.completed);
        console.log("Filtered active tasks:", filteredTasks.length);
    } else if (filter === 'completed') {
        filteredTasks = filteredTasks.filter(task => task.completed);
        console.log("Filtered completed tasks:", filteredTasks.length);
    } else {
        console.log("Showing all tasks:", filteredTasks.length);
    }

    // Separate pinned and unpinned tasks
    let pinnedInScope = filteredTasks.filter(task => task.pinned);
    let unpinnedInScope = filteredTasks.filter(task => !task.pinned);

    // Function to apply chosen sort
    const applySortLogic = (tasksToSort, sortType) => {
        if (sortType === 'deadline') {
            tasksToSort.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        } else if (sortType === 'priority') {
            const priorityOrder = { high: 1, medium: 2, low: 3 };
            tasksToSort.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        } else {
            tasksToSort.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Default: newest first
        }
        return tasksToSort;
    };

    // Sort pinned and unpinned groups separately
    pinnedInScope = applySortLogic(pinnedInScope, sort);
    unpinnedInScope = applySortLogic(unpinnedInScope, sort);

    // Recombine, pinned first, for general rendering or if not by category
    if (!(filter === 'active' && activeSort === 'category')) {
        filteredTasks = [...pinnedInScope, ...unpinnedInScope];
        console.log("Sorted with pinned tasks first, then by:", sort);
    }

    // Handle category-based sorting for active tasks
    if (filter === 'active' && activeSort === 'category') {
        const tasksByCategory = {};
        filteredTasks.forEach(task => {
            const category = task.category || 'Uncategorized';
            if (!tasksByCategory[category]) {
                tasksByCategory[category] = [];
            }
            tasksByCategory[category].push(task);
        });

        // For each category, sort its tasks with pinned items first, then by the main sort criteria
        for (const category in tasksByCategory) {
            let categoryTasks = tasksByCategory[category];
            let pinnedInCategory = categoryTasks.filter(t => t.pinned);
            let unpinnedInCategory = categoryTasks.filter(t => !t.pinned);

            pinnedInCategory = applySortLogic(pinnedInCategory, sort);
            unpinnedInCategory = applySortLogic(unpinnedInCategory, sort);

            tasksByCategory[category] = [...pinnedInCategory, ...unpinnedInCategory];
        }



        if (Object.keys(tasksByCategory).length === 0) {
            console.log("No tasks to display, showing empty state");
            emptyState.style.display = 'block';
            taskList.innerHTML = '';
            return;
        } else {
            emptyState.style.display = 'none';
        }

        Object.keys(tasksByCategory).sort().forEach(category => {
            const categoryTitle = document.createElement('h2');
            categoryTitle.className = 'category-title';
            const firstTask = tasksByCategory[category][0];
            const iconClass = firstTask.icon || 'fa-tag';
            categoryTitle.innerHTML = `<i class="fas ${iconClass}"></i> ${category}`;
            taskList.appendChild(categoryTitle);

            // Tasks within tasksByCategory[category] are already sorted (pinned first, then by 'sort')
            
            tasksByCategory[category].forEach(task => {
                renderTaskItem(task, taskList);
            });
        });
        console.log("Rendered tasks by category");
    } else {
        if (filteredTasks.length === 0) {
            console.log("No tasks to display, showing empty state");
            emptyState.style.display = 'block';
            taskList.innerHTML = '';
            return;
        } else {
            emptyState.style.display = 'none';
        }

        filteredTasks.forEach(task => {
            renderTaskItem(task, taskList);
        });
        console.log("Rendered tasks normally");
    }
}

function renderTaskItem(task, taskList) {
    console.log("Rendering task:", task.id, task.title);
    const taskItem = document.createElement('li');
    taskItem.className = `task-item ${task.completed ? 'completed' : ''} ${task.pinned ? 'pinned-task' : ''}`;
    taskItem.dataset.id = task.id;

    const taskIconClass = task.icon || 'fa-tag';
    const pinTitle = task.pinned ? 'Unpin task' : 'Pin task';
    taskItem.innerHTML = `
        <div class="task-header">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <div class="task-title ${task.completed ? 'completed' : ''}">${task.title}</div>
            <div class="task-actions">
                <button class="task-btn pin-btn ${task.pinned ? 'pinned' : ''}" data-id="${task.id}" title="${pinTitle}"><i class="fas fa-thumbtack"></i></button>
                <button class="task-btn edit-btn" data-id="${task.id}"><i class="fas fa-edit"></i></button>
                <button class="task-btn delete-btn" data-id="${task.id}"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        <div class="task-meta">
            <div class="task-priority priority-${task.priority}">${task.priority.toUpperCase()}</div>
            <div class="task-deadline ${isOverdue(task.deadline) && !task.completed ? 'overdue' : ''}">
                <i class="fas fa-calendar-alt"></i> ${formatDate(task.deadline)}
            </div>
            ${task.category ? `
            <div class="task-category">
                <i class="fas ${taskIconClass}"></i> ${task.category}
            </div>
            ` : ''}
        </div>
        <div class="task-details">
            <div class="task-details-content">
                ${task.brief ? `
                <div class="task-details-text">${task.brief}</div>
                ` : ''}
                ${renderRevisions(task.revisions)}
            </div>
        </div>
    `;

    taskList.appendChild(taskItem);
}

function renderRevisions(revisions) {
    if (!revisions || revisions.length === 0) return '';

    return `
        <div class="revision-history">
            <div style="font-weight: 600; margin-bottom: 0.5rem;">Revision History:</div>
            ${revisions.map(rev => `
                <div class="revision-item">
                    <div class="revision-date">${new Date(rev.date).toLocaleString()}</div>
                    <div class="revision-text">${rev.note}</div>
                </div>
            `).join('')}
        </div>
    `;
}

export async function addTask(taskData, encodedUsername, toggleAddTaskForm, animateAddTask, renderTasksCallback) {
    console.log("Adding new task:", taskData);
    const { title, brief, category, icon, priority, deadline } = taskData;

    if (!title) {
        console.error("Task title is empty");
        alert('Please enter a task title');
        return;
    }

    const newTask = {
        id: Date.now().toString(),
        title,
        brief,
        category,
        icon,
        priority,
        deadline,
        completed: false,
        pinned: false, // Default to not pinned
        createdAt: new Date().toISOString(),
        revisions: []
    };

    try {
        const userDocRef = doc(db, "users", encodedUsername);
        console.log("Updating Firestore with new task...");
        await updateDoc(userDocRef, {
            tasks: arrayUnion(newTask)
        });

        tasks.push(newTask); // Update local tasks array
        localStorage.setItem(`tasks_${encodedUsername}`, JSON.stringify(tasks));
        console.log("Task added and cached:", newTask);

        if (category && !allCategories.includes(category)) {
            allCategories.push(category);
            allCategories.sort();
            console.log("Updated categories:", allCategories);
        }

        toggleAddTaskForm(false);
        animateAddTask();
        await loadTasks(encodedUsername, renderTasksCallback); // Use the passed callback
    } catch (error) {
        console.error("Error adding task:", error);
        alert('Failed to add task. Please try again.');
    }
}

export async function toggleTaskComplete(taskId, encodedUsername, showCelebration, renderTasksCallback) {
    console.log("Toggling task completion:", taskId);
    try {
        const userDocRef = doc(db, "users", encodedUsername);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const tasksData = docSnap.data().tasks;
            const updatedTasks = tasksData.map(task => {
                if (task.id === taskId) {
                    const updatedTask = { ...task, completed: !task.completed };
                    if (updatedTask.completed) {
                        showCelebration();
                    }
                    return updatedTask;
                }
                return task;
            });

            await updateDoc(userDocRef, { tasks: updatedTasks });
            tasks = updatedTasks; // Update local tasks array
            localStorage.setItem(`tasks_${encodedUsername}`, JSON.stringify(updatedTasks));
            console.log("Task completion toggled:", taskId);
            await loadTasks(encodedUsername, renderTasksCallback); // Use the passed callback
        } else {
            console.error("User document not found");
        }
    } catch (error) {
        console.error("Error toggling task:", error);
        alert('Failed to toggle task. Please try again.');
    }
}

export async function saveEditedTask(taskData, encodedUsername, hideEditFormCallback, renderTasksCallback) {
    console.log("Saving edited task:", currentEditingTask);
    if (!currentEditingTask) {
        console.error("No task being edited");
        return;
    }

    const { title, brief, category, icon, priority, deadline, revisionNote } = taskData;

    if (!title) {
        console.error("Edited task title is empty");
        alert('Please enter a task title');
        return;
    }

    try {
        const userDocRef = doc(db, "users", encodedUsername);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const tasksData = docSnap.data().tasks;
            const updatedTasks = tasksData.map(task => {
                if (task.id === currentEditingTask.id) {
                    const updatedTask = {
                        ...task,
                        title,
                        brief,
                        category,
                        icon,
                        priority,
                        deadline
                    };

                    if (revisionNote) {
                        updatedTask.revisions = [
                            ...(task.revisions || []),
                            {
                                date: new Date().toISOString(),
                                note: revisionNote
                            }
                        ];
                    }

                    return updatedTask;
                }
                return task;
            });

            await updateDoc(userDocRef, { tasks: updatedTasks });
            tasks = updatedTasks; // Update local tasks array
            localStorage.setItem(`tasks_${encodedUsername}`, JSON.stringify(updatedTasks));
            console.log("Task updated:", currentEditingTask.id);

            if (category && !allCategories.includes(category)) {
                allCategories.push(category);
                allCategories.sort();
                console.log("Updated categories:", allCategories);
            }

            hideEditFormCallback();
            await loadTasks(encodedUsername, renderTasksCallback); // Use the passed callback
        } else {
            console.error("User document not found");
        }
    } catch (error) {
        console.error("Error updating task:", error);
        alert('Failed to update task. Please try again.');
    }
}

export async function deleteTask(taskId, encodedUsername, renderTasksCallback) {
    console.log("Deleting task:", taskId);
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
        const userDocRef = doc(db, "users", encodedUsername);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const tasksData = docSnap.data().tasks;
            const updatedTasks = tasksData.filter(task => task.id !== taskId);
            await updateDoc(userDocRef, { tasks: updatedTasks });
            tasks = updatedTasks; // Update local tasks array
            localStorage.setItem(`tasks_${encodedUsername}`, JSON.stringify(updatedTasks));
            console.log("Task deleted:", taskId);
            await loadTasks(encodedUsername, renderTasksCallback); // Use the passed callback
        } else {
            console.error("User document not found");
        }
    } catch (error) {
        console.error("Error deleting task:", error);
        alert('Failed to delete task. Please try again.');
    }
}

export async function togglePinTask(taskId, encodedUsername, renderTasksCallback) {
    console.log("Toggling pin status for task:", taskId);
    try {
        const userDocRef = doc(db, "users", encodedUsername);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const tasksData = docSnap.data().tasks;
            let taskPinnedStatusChanged = false;
            const updatedTasks = tasksData.map(task => {
                if (task.id === taskId) {
                    taskPinnedStatusChanged = true;
                    return { ...task, pinned: !task.pinned };
                }
                return task;
            });

            if (taskPinnedStatusChanged) {
                await updateDoc(userDocRef, { tasks: updatedTasks });
                localStorage.setItem(`tasks_${encodedUsername}`, JSON.stringify(updatedTasks)); 
                console.log("Task pin status toggled and updated in Firestore:", taskId);
                await loadTasks(encodedUsername, renderTasksCallback); 
            } else {
                console.warn("Task not found for pinning:", taskId);
            }
        } else {
            console.error("User document not found for pinning task");
        }
    } catch (error) {
        console.error("Error toggling pin status:", error);
        alert('Failed to toggle pin status. Please try again.');
    }
}

export async function exportAllTasksToTXT(encodedUsername, username, toggleSettingsPanel) {
    console.log("Exporting all tasks to TXT for user:", username);
    try {
        const userDocRef = doc(db, "users", encodedUsername);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists() || !docSnap.data().tasks || docSnap.data().tasks.length === 0) {
            console.log("No tasks found to export");
            alert('No tasks found to export.');
            return;
        }

        const tasksData = docSnap.data().tasks;
        let content = `My Task List\n\n`;
        content += `Username: ${username}\n`;
        content += `Generated on: ${new Date().toLocaleString()}\n`;
        content += `Total tasks: ${tasksData.length}\n\n`;
        content += "----------------------------------------\n\n";

        tasksData.forEach((task, index) => {
            content += `${index + 1}. ${task.title}\n`;
            content += `   Status: ${task.completed ? 'Completed' : 'Pending'}\n`;
            content += `   Pinned: ${task.pinned ? 'Yes' : 'No'}\n`;
            content += `   Category: ${task.category || 'Uncategorized'}\n`;
            content += `   Icon: ${availableIcons[task.icon] || 'Tag'}\n`;
            content += `   Priority: ${task.priority.toUpperCase()}\n`;
            content += `   Deadline: ${formatDate(task.deadline)}${isOverdue(task.deadline) && !task.completed ? ' (Overdue)' : ''}\n`;
            if (task.brief) {
                content += `   Details: ${task.brief}\n`;
            }
            if (task.revisions && task.revisions.length > 0) {
                content += `   Revisions:\n`;
                task.revisions.forEach((rev, revIndex) => {
                    content += `     ${revIndex + 1}. ${new Date(rev.date).toLocaleString()}: ${rev.note}\n`;
                });
            }
            content += "\n----------------------------------------\n\n";
        });

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${username}_tasks.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("Tasks exported successfully");
        toggleSettingsPanel(false);
    } catch (error) {
        console.error("Error exporting tasks:", error);
        alert(`Failed to export tasks: ${error.message}. Please try again.`);
    }
}

export function setCurrentEditingTask(task) {
    currentEditingTask = task;
    console.log("Set current editing task:", task ? task.id : null);
}

export function getCurrentFilter() {
    return currentFilter;
}

export function setCurrentFilter(filter) {
    currentFilter = filter;
    console.log("Set filter:", filter);
}

export function getCurrentSort() {
    return currentSort;
}

export function setCurrentSort(sort) {
    currentSort = sort;
    console.log("Set sort:", sort);
}

export function getCurrentActiveSort() {
    return currentActiveSort;
}

export function setCurrentActiveSort(activeSort) {
    currentActiveSort = activeSort;
    console.log("Set active sort:", activeSort);
}

export function getCurrentSearch() {
    return currentSearch;
}

export function setCurrentSearch(search) {
    currentSearch = search;
    console.log("Set search:", search);
}

export function getAllCategories() {
    return allCategories;
}

export function getAvailableIcons() {
    return availableIcons;
}

export function getTasks() {
    return tasks;
}