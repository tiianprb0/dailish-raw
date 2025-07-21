import { db, doc, deleteDoc } from './firebase.js';

export async function deleteAccount(encodedUsername) {
    console.log("Attempting to delete account for user:", encodedUsername);

    try {
        const userDocRef = doc(db, "users", encodedUsername);
        console.log("Deleting user document in Firestore...");
        await deleteDoc(userDocRef);

        localStorage.removeItem(`tasks_${encodedUsername}`);
        localStorage.removeItem('todo_username');
        localStorage.removeItem('todo_username_fallback');
        localStorage.removeItem('todo_theme');
        console.log("Cleared local storage");

        console.log("Account deleted successfully");
        alert('Your account has been deleted.');
        window.location.href = '/tools/todolist/index.html';
    } catch (error) {
        console.error("Error deleting account:", error);
        alert('Failed to delete account. Please try again.');
    }
}