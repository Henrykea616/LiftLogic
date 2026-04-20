// ===== DATA / SETUP =====
let appData = { routines: [] };
let currentRoutineId = null;
let progressChart = null;

try {
    appData = JSON.parse(localStorage.getItem("gymAppData")) || {
        routines: []
    };
} catch (error) {
    appData = { routines: [] };
    localStorage.removeItem("gymAppData");
}

// ===== API / AUTH FUNCTIONS =====
const API_BASE = "http://localhost:3000";

function isLoggedIn() {
    return !!localStorage.getItem("token");
}

function saveData() {
    localStorage.setItem("gymAppData", JSON.stringify(appData));
}

function generateId() {
    return Date.now().toString() + Math.random().toString(16).slice(2);
}

function updateAuthUI() {
    const authSection = document.getElementById("authSection");
    const homePage = document.getElementById("homePage");

    if (!authSection || !homePage) return;

    if (isLoggedIn()) {
        authSection.classList.add("hidden");
        homePage.classList.remove("hidden");
    } else {
        authSection.classList.remove("hidden");
        homePage.classList.remove("hidden");
    }
}

async function signUp(email, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/signup`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Signup failed");
            return false;
        }

        alert("Account created! You can now log in.");

        const signupEmail = document.getElementById("signupEmail");
        const signupPassword = document.getElementById("signupPassword");

        if (signupEmail) signupEmail.value = "";
        if (signupPassword) signupPassword.value = "";

        return true;
    } catch (error) {
        alert("Error connecting to server.");
        console.error(error);
        return false;
    }
}

function handleSignup() {
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value.trim();

    if (!email || !password) {
        alert("Please enter email and password.");
        return;
    }

    signUp(email, password);
}

async function logIn(email, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Login failed");
            return false;
        }

        localStorage.setItem("token", data.token);

        const loginEmail = document.getElementById("loginEmail");
        const loginPassword = document.getElementById("loginPassword");

        if (loginEmail) loginEmail.value = "";
        if (loginPassword) loginPassword.value = "";

        updateAuthUI();
        await loadRoutines();
        alert("Logged in successfully!");
        return true;
    } catch (error) {
        alert("Error connecting to server.");
        console.error(error);
        return false;
    }
}

function handleLogin() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
        alert("Please enter email and password.");
        return;
    }

    logIn(email, password);
}

function logOut() {
    localStorage.removeItem("token");
    currentRoutineId = null;

    const routinePage = document.getElementById("routinePage");
    const homePage = document.getElementById("homePage");

    if (routinePage) routinePage.classList.add("hidden");
    if (homePage) homePage.classList.remove("hidden");

    appData = JSON.parse(localStorage.getItem("gymAppData")) || { routines: [] };
    updateAuthUI();
    renderHomePage();
}

async function createRoutineBackend(name) {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_BASE}/api/routines`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to create routine");
    }

    return data;
}

async function loadRoutines() {
    const token = localStorage.getItem("token");

    if (!token) {
        renderHomePage();
        return;
    }

    const response = await fetch(`${API_BASE}/api/routines`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to load routines");
    }

    appData.routines = data;
    renderHomePage();
}

app.put("/api/routines/:id", authMiddleware, async (req, res) => {
    try {
        const routineId = req.params.id;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Routine name is required" });
        }

        const result = await routinesCollection.findOneAndUpdate(
            {
                id: routineId,
                userId: req.user.userId
            },
            {
                $set: {
                    name: name.trim()
                }
            },
            {
                returnDocument: "after"
            }
        );

        if (!result) {
            return res.status(404).json({ error: "Routine not found" });
        }

        res.json(result);
    } catch (error) {
        console.error("Update routine error:", error);
        res.status(500).json({ error: "Failed to update routine" });
    }
});

async function deleteRoutineBackend(routineId) {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_BASE}/api/routines/${routineId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to delete routine");
    }

    return data;
}

async function updateRoutineBackend(routineId, name) {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_BASE}/api/routines/${routineId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to update routine");
    }

    return data;
}

// ===== ROUTINE FUNCTIONS =====
async function createRoutine() {
    const input = document.getElementById("routineNameInput");
    const name = input.value.trim();

    if (!name) {
        alert("Please enter a routine name.");
        return;
    }

    try {
        if (isLoggedIn()) {
            const newRoutine = await createRoutineBackend(name);
            appData.routines.push(newRoutine);
        } else {
            const newRoutine = {
                id: generateId(),
                name: name,
                weeks: [
                    {
                        weekNumber: 1,
                        date: new Date().toLocaleDateString(),
                        completed: false,
                        completedAt: "",
                        exercises: []
                    }
                ]
            };

            appData.routines.push(newRoutine);
            saveData();
        }

        input.value = "";
        renderHomePage();
    } catch (error) {
        alert(error.message);
        console.error(error);
    }
}

async function deleteRoutine(routineId) {
    const confirmed = confirm("Are you sure you want to delete this routine?");
    if (!confirmed) return;

    try {
        if (isLoggedIn()) {
            await deleteRoutineBackend(routineId);
        }

        appData.routines = appData.routines.filter(routine => routine.id !== routineId);
        saveData();

        if (currentRoutineId === routineId) {
            currentRoutineId = null;
            document.getElementById("routinePage").classList.add("hidden");
            document.getElementById("homePage").classList.remove("hidden");
        }

        renderHomePage();
    } catch (error) {
        alert(error.message);
        console.error(error);
    }
}

async function editRoutine(routineId) {
    const routine = appData.routines.find(r => r.id === routineId);
    if (!routine) return;

    const newName = prompt("Enter a new routine name:", routine.name);
    if (newName === null) return;

    const trimmedName = newName.trim();
    if (!trimmedName) {
        alert("Routine name cannot be empty.");
        return;
    }

    try {
        if (isLoggedIn()) {
            const updatedRoutine = await updateRoutineBackend(routineId, trimmedName);
            const index = appData.routines.findIndex(r => r.id === routineId);
            if (index !== -1) {
                appData.routines[index] = updatedRoutine;
            }
        } else {
            routine.name = trimmedName;
            saveData();
        }

        renderHomePage();

        if (currentRoutineId === routineId) {
            renderRoutinePage();
        }
    } catch (error) {
        alert(error.message);
        console.error(error);
    }
}

function openRoutine(routineId) {
    currentRoutineId = routineId;
    document.getElementById("homePage").classList.add("hidden");
    document.getElementById("routinePage").classList.remove("hidden");
    renderRoutinePage();
}

function goHome() {
    currentRoutineId = null;
    document.getElementById("routinePage").classList.add("hidden");
    document.getElementById("homePage").classList.remove("hidden");
    renderHomePage();
}

function getCurrentRoutine() {
    return appData.routines.find(routine => routine.id === currentRoutineId);
}

// ===== WEEK FUNCTIONS =====
function addWeek() {
    const routine = getCurrentRoutine();
    if (!routine) return;

    const lastWeek = routine.weeks[routine.weeks.length - 1];

    if (!lastWeek.completed) {
        const continueAnyway = confirm(
            "Your latest week is not marked complete. Do you still want to add a new week?"
        );

        if (!continueAnyway) return;
    }

    if (lastWeek.exercises.length === 0) {
        alert("Add at least one exercise before creating a new week.");
        return;
    }

    const nextWeekNumber = routine.weeks.length + 1;

    const copiedExercises = lastWeek.exercises.map(exercise => ({
        id: generateId(),
        name: exercise.name,
        bodyPart: exercise.bodyPart,
        repRange: {
            min: exercise.repRange.min,
            max: exercise.repRange.max
        },
        sets: exercise.sets.map(set => ({
            reps: "",
            weight: set.weight || "",
            notes: ""
        }))
    }));

    routine.weeks.push({
        weekNumber: nextWeekNumber,
        date: new Date().toLocaleDateString(),
        completed: false,
        completedAt: "",
        exercises: copiedExercises
    });

    saveData();
    renderRoutinePage(nextWeekNumber);
}

function completeWorkout() {
    const selectedWeek = getSelectedWeek();
    if (!selectedWeek) return;

    if (selectedWeek.exercises.length === 0) {
        alert("You cannot complete a week with no exercises.");
        return;
    }

    const hasAnyLoggedSet = selectedWeek.exercises.some(exercise =>
        exercise.sets.some(set => set.reps || set.weight)
    );

    if (!hasAnyLoggedSet) {
        const confirmComplete = confirm(
            "No reps or weights have been logged. Mark this week as complete anyway?"
        );

        if (!confirmComplete) return;
    }

    selectedWeek.completed = true;
    selectedWeek.completedAt = new Date().toLocaleString();
    saveData();
    renderRoutinePage(selectedWeek.weekNumber);
}

function populateWeekSelect(selectedWeek = null) {
    const routine = getCurrentRoutine();
    const weekSelect = document.getElementById("weekSelect");
    weekSelect.innerHTML = "";

    if (!routine) return;

    routine.weeks.forEach(week => {
        const option = document.createElement("option");
        option.value = week.weekNumber;
        option.textContent = week.completed
            ? `Week ${week.weekNumber} ✓`
            : `Week ${week.weekNumber}`;
        weekSelect.appendChild(option);
    });

    if (selectedWeek !== null) {
        weekSelect.value = selectedWeek;
    }
}

function getSelectedWeek() {
    const routine = getCurrentRoutine();
    if (!routine) return null;

    const weekNumber = Number(document.getElementById("weekSelect").value);
    return routine.weeks.find(week => week.weekNumber === weekNumber);
}

function getPreviousWeek(currentWeekNumber) {
    const routine = getCurrentRoutine();
    if (!routine) return null;

    return routine.weeks.find(week => week.weekNumber === currentWeekNumber - 1);
}

// ===== EXERCISE FUNCTIONS =====
function addExercise() {
    const selectedWeek = getSelectedWeek();
    if (!selectedWeek) return;

    const nameInput = document.getElementById("exerciseNameInput");
    const bodyPartInput = document.getElementById("bodyPartInput");
    const minRepsInput = document.getElementById("minRepsInput");
    const maxRepsInput = document.getElementById("maxRepsInput");

    const exerciseName = nameInput.value.trim();
    const bodyPart = bodyPartInput.value;
    const minReps = Number(minRepsInput.value);
    const maxReps = Number(maxRepsInput.value);

    if (!exerciseName) {
        alert("Please enter an exercise name.");
        return;
    }

    if (!minReps || !maxReps || minReps <= 0 || maxReps <= 0) {
        alert("Reps must be positive numbers.");
        return;
    }

    if (minReps > maxReps) {
        alert("Min reps cannot be greater than max reps.");
        return;
    }

    selectedWeek.exercises.push({
        id: generateId(),
        name: exerciseName,
        bodyPart: bodyPart,
        repRange: {
            min: minReps,
            max: maxReps
        },
        sets: [
            { reps: "", weight: "", notes: "" }
        ]
    });

    nameInput.value = "";
    minRepsInput.value = "";
    maxRepsInput.value = "";

    saveData();
    renderRoutinePage(selectedWeek.weekNumber);
}

function editExercise(exerciseId) {
    const selectedWeek = getSelectedWeek();
    if (!selectedWeek) return;

    const exercise = selectedWeek.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const newName = prompt("Edit exercise name:", exercise.name);
    if (newName === null) return;

    const trimmedName = newName.trim();
    if (!trimmedName) {
        alert("Exercise name cannot be empty.");
        return;
    }

    const newBodyPart = prompt("Edit body part:", exercise.bodyPart);
    if (newBodyPart === null) return;

    const trimmedBodyPart = newBodyPart.trim();
    if (!trimmedBodyPart) {
        alert("Body part cannot be empty.");
        return;
    }

    const newMinReps = prompt("Edit minimum reps:", exercise.repRange.min);
    if (newMinReps === null) return;

    const newMaxReps = prompt("Edit maximum reps:", exercise.repRange.max);
    if (newMaxReps === null) return;

    const minReps = Number(newMinReps);
    const maxReps = Number(newMaxReps);

    if (!minReps || !maxReps || minReps <= 0 || maxReps <= 0) {
        alert("Reps must be positive numbers.");
        return;
    }

    if (minReps > maxReps) {
        alert("Min reps cannot be greater than max reps.");
        return;
    }

    exercise.name = trimmedName;
    exercise.bodyPart = trimmedBodyPart;
    exercise.repRange.min = minReps;
    exercise.repRange.max = maxReps;

    saveData();
    renderRoutinePage(selectedWeek.weekNumber);
}

function deleteExercise(exerciseId) {
    const confirmed = confirm("Are you sure you want to delete this exercise?");
    if (!confirmed) return;

    const selectedWeek = getSelectedWeek();
    if (!selectedWeek) return;

    selectedWeek.exercises = selectedWeek.exercises.filter(
        exercise => exercise.id !== exerciseId
    );

    saveData();
    renderRoutinePage(selectedWeek.weekNumber);
}

function addSet(exerciseId) {
    const selectedWeek = getSelectedWeek();
    if (!selectedWeek) return;

    const exercise = selectedWeek.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    exercise.sets.push({
        reps: "",
        weight: "",
        notes: ""
    });

    saveData();
    renderRoutinePage(selectedWeek.weekNumber);
}

function deleteSet(exerciseId, setIndex) {
    const selectedWeek = getSelectedWeek();
    if (!selectedWeek) return;

    const exercise = selectedWeek.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    if (exercise.sets.length === 1) {
        alert("You must keep at least one set.");
        return;
    }

    const confirmed = confirm("Are you sure you want to delete this set?");
    if (!confirmed) return;

    exercise.sets.splice(setIndex, 1);
    saveData();
    renderRoutinePage(selectedWeek.weekNumber);
}

function updateSetValue(exerciseId, setIndex, field, value) {
    const selectedWeek = getSelectedWeek();
    if (!selectedWeek) return;

    const exercise = selectedWeek.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    exercise.sets[setIndex][field] = value;
    saveData();
}

// ===== PROGRESS / CALCULATIONS =====
function getPreviousExerciseData(exerciseName, currentWeekNumber) {
    const previousWeek = getPreviousWeek(currentWeekNumber);
    if (!previousWeek) return null;

    return previousWeek.exercises.find(
        exercise => exercise.name.toLowerCase() === exerciseName.toLowerCase()
    ) || null;
}

function getProgressCheck(currentExercise, previousExercise) {
    if (!previousExercise) {
        return "No previous week data yet.";
    }

    if (!currentExercise.repRange) {
        return "No rep range set.";
    }

    let hitAllMinimums = true;
    let hitTopOfRange = true;
    let sameWeightAllSets = true;
    let improved = false;

    currentExercise.sets.forEach((set, index) => {
        const currentReps = Number(set.reps);
        const currentWeight = Number(set.weight);

        const prevSet = previousExercise.sets[index];
        if (!prevSet) {
            hitAllMinimums = false;
            hitTopOfRange = false;
            return;
        }

        const prevReps = Number(prevSet.reps);
        const prevWeight = Number(prevSet.weight);

        if (!currentReps || !currentWeight) {
            hitAllMinimums = false;
            hitTopOfRange = false;
            return;
        }

        if (currentReps < currentExercise.repRange.min) {
            hitAllMinimums = false;
        }

        if (currentReps < currentExercise.repRange.max) {
            hitTopOfRange = false;
        }

        if (currentWeight !== prevWeight) {
            sameWeightAllSets = false;
        }

        if (
            currentWeight > prevWeight ||
            (currentWeight === prevWeight && currentReps > prevReps)
        ) {
            improved = true;
        }
    });

    if (hitTopOfRange && sameWeightAllSets) {
        if (["Biceps", "Triceps", "Shoulders"].includes(currentExercise.bodyPart)) {
            return "Move up 2.5-5 lb next week.";
        }
        return "Move up 5-10 lb next week.";
    }

    if (hitAllMinimums && improved) {
        return "Improving. Stay at this weight one more week.";
    }

    if (!hitAllMinimums) {
        return "Weight may be too heavy. Stay here until you hit the minimum reps.";
    }

    return "Repeat this weight until all target reps are hit.";
}

function calculateExerciseVolume(exercise) {
    let total = 0;

    exercise.sets.forEach(set => {
        const reps = Number(set.reps);
        const weight = Number(set.weight);

        if (!isNaN(reps) && !isNaN(weight)) {
            total += reps * weight;
        }
    });

    return total;
}

function getExercisePR(exerciseName) {
    let bestWeight = 0;
    let bestReps = 0;

    appData.routines.forEach(routine => {
        routine.weeks.forEach(week => {
            week.exercises.forEach(exercise => {
                if (exercise.name.toLowerCase() === exerciseName.toLowerCase()) {
                    exercise.sets.forEach(set => {
                        const weight = Number(set.weight);
                        const reps = Number(set.reps);

                        if (weight > bestWeight) {
                            bestWeight = weight;
                            bestReps = reps;
                        } else if (weight === bestWeight && reps > bestReps) {
                            bestReps = reps;
                        }
                    });
                }
            });
        });
    });

    return { bestWeight, bestReps };
}

function getExerciseHistory(exerciseName) {
    const history = [];

    appData.routines.forEach(routine => {
        routine.weeks.forEach(week => {
            week.exercises.forEach(exercise => {
                if (exercise.name.toLowerCase() === exerciseName.toLowerCase()) {
                    history.push({
                        weekNumber: week.weekNumber,
                        date: week.date || "No date",
                        sets: exercise.sets
                    });
                }
            });
        });
    });

    return history;
}

function calculateBodyPartVolumes() {
    const totals = {};

    appData.routines.forEach(routine => {
        routine.weeks.forEach(week => {
            week.exercises.forEach(exercise => {
                const bodyPart = exercise.bodyPart || "Unknown";
                const volume = calculateExerciseVolume(exercise);

                if (!totals[bodyPart]) {
                    totals[bodyPart] = 0;
                }

                totals[bodyPart] += volume;
            });
        });
    });

    return totals;
}

function detectPlateau(exerciseName) {
    const history = getExerciseHistory(exerciseName);

    if (history.length < 3) return null;

    const last3 = history.slice(-3);
    let noImprovement = true;

    for (let i = 1; i < last3.length; i++) {
        const prevSets = last3[i - 1].sets;
        const currentSets = last3[i].sets;

        let improved = false;

        currentSets.forEach((set, index) => {
            const prevSet = prevSets[index];
            if (!prevSet) return;

            const currentWeight = Number(set.weight);
            const currentReps = Number(set.reps);
            const prevWeight = Number(prevSet.weight);
            const prevReps = Number(prevSet.reps);

            if (
                currentWeight > prevWeight ||
                (currentWeight === prevWeight && currentReps > prevReps)
            ) {
                improved = true;
            }
        });

        if (improved) {
            noImprovement = false;
        }
    }

    if (noImprovement) {
        return "⚠️ Plateau detected: no progress in the last 3 workouts.";
    }

    return null;
}

function getExerciseChartData(exerciseName) {
    const labels = [];
    const weights = [];

    appData.routines.forEach(routine => {
        routine.weeks.forEach(week => {
            week.exercises.forEach(exercise => {
                if (exercise.name.toLowerCase() === exerciseName.toLowerCase()) {
                    let bestWeight = 0;

                    exercise.sets.forEach(set => {
                        const weight = Number(set.weight);
                        if (!isNaN(weight) && weight > bestWeight) {
                            bestWeight = weight;
                        }
                    });

                    labels.push(`Week ${week.weekNumber}`);
                    weights.push(bestWeight);
                }
            });
        });
    });

    return { labels, weights };
}

function renderProgressChart(exerciseName) {
    const canvas = document.getElementById("progressChart");
    if (!canvas) return;

    const { labels, weights } = getExerciseChartData(exerciseName);

    if (progressChart) {
        progressChart.destroy();
    }

    if (labels.length === 0) return;

    progressChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: `${exerciseName} Best Weight`,
                    data: weights,
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: `${exerciseName} Progress`
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Week"
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Weight"
                    }
                }
            }
        }
    });
}

// ===== RENDER FUNCTIONS =====
function renderHomePage() {
    const grid = document.getElementById("routineGrid");
    const summaryDiv = document.getElementById("bodyPartSummary");

    grid.innerHTML = "";
    summaryDiv.innerHTML = "";

    if (appData.routines.length === 0) {
        grid.innerHTML = "<p>No workout routines yet. Create one above.</p>";
        summaryDiv.innerHTML = "<p>No body-part data yet.</p>";
        return;
    }

    appData.routines.forEach(routine => {
        const card = document.createElement("div");
        card.className = "routine-card";

        card.innerHTML = `
            <div class="routine-title">${routine.name}</div>
            <div>Total Weeks: ${routine.weeks.length}</div>
            <div class="routine-actions">
                <button onclick="openRoutine('${routine.id}')">Open</button>
                <button class="secondary-btn" onclick="editRoutine('${routine.id}')">Edit</button>
                <button class="danger-btn" onclick="deleteRoutine('${routine.id}')">Delete</button>
            </div>
        `;

        grid.appendChild(card);
    });

    const totals = calculateBodyPartVolumes();
    const entries = Object.entries(totals);

    if (entries.length === 0) {
        summaryDiv.innerHTML = '<div class="summary-card"><p>No body-part data yet.</p></div>';
        return;
    }

    entries.sort((a, b) => a[1] - b[1]);

    const lowest = entries[0];
    const highest = entries[entries.length - 1];

    const detailsHTML = entries
        .map(([bodyPart, volume]) => `<div><strong>${bodyPart}:</strong> ${volume}</div>`)
        .join("");

    summaryDiv.innerHTML = `
        <div class="summary-card">
            <p><strong>Most trained:</strong> ${highest[0]} (${highest[1]} total lbs)</p>
            <p><strong>Least trained:</strong> ${lowest[0]} (${lowest[1]} total lbs)</p>
            <p><strong>Needs more work:</strong> ${lowest[0]}</p>
            <div class="summary-list">
                ${detailsHTML}
            </div>
        </div>
    `;
}

function renderRoutinePage(selectedWeekNumber = null) {
    const routine = getCurrentRoutine();
    if (!routine) return;

    const defaultWeek =
        selectedWeekNumber !== null
            ? selectedWeekNumber
            : routine.weeks[routine.weeks.length - 1].weekNumber;

    populateWeekSelect(defaultWeek);

    const selectedWeek = getSelectedWeek();
    const exerciseList = document.getElementById("exerciseList");
    const title = document.getElementById("routinePageTitle");

    if (!selectedWeek) return;

    const latestWeekNumber = routine.weeks[routine.weeks.length - 1].weekNumber;
    const currentLabel =
        selectedWeek.weekNumber === latestWeekNumber ? " - Current Week" : "";

    title.textContent = `${routine.name} - Week ${selectedWeek.weekNumber}${currentLabel} (${selectedWeek.date || "No date"})`;

    exerciseList.innerHTML = "";

    const completionText = selectedWeek.completed
        ? `Completed on: ${selectedWeek.completedAt || "Yes"}`
        : "Not completed yet";

    const statusDiv = document.createElement("div");
    statusDiv.className = "summary-card";
    statusDiv.innerHTML = `<p><strong>Status:</strong> ${completionText}</p>`;
    exerciseList.appendChild(statusDiv);

    if (selectedWeek.exercises.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "No exercises added for this week yet.";
        exerciseList.appendChild(emptyMessage);
        return;
    }

    renderProgressChart(selectedWeek.exercises[0].name);

    selectedWeek.exercises.forEach(exercise => {
        const previousExercise = getPreviousExerciseData(
            exercise.name,
            selectedWeek.weekNumber
        );

        const pr = getExercisePR(exercise.name);
        const progressMessage = getProgressCheck(exercise, previousExercise);
        const plateauMessage = detectPlateau(exercise.name);

        const card = document.createElement("div");
        card.className = "exercise-card";

        let rowsHTML = "";

        const history = getExerciseHistory(exercise.name);
        const historyHTML = history.map(entry => {
            const setText = entry.sets.map((set, i) =>
                `Set ${i + 1}: ${set.weight || "-"} lb x ${set.reps || "-"}`
            ).join(" | ");

            return `<div>Week ${entry.weekNumber} (${entry.date}): ${setText}</div>`;
        }).join("");

        exercise.sets.forEach((set, index) => {
            rowsHTML += `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        <input
                            type="number"
                            min="0"
                            value="${set.reps}"
                            onchange="updateSetValue('${exercise.id}', ${index}, 'reps', this.value)"
                            placeholder="Reps"
                        />
                    </td>
                    <td>
                        <input
                            type="number"
                            min="0"
                            value="${set.weight}"
                            onchange="updateSetValue('${exercise.id}', ${index}, 'weight', this.value)"
                            placeholder="Weight"
                        />
                    </td>
                    <td>
                        <input
                            type="text"
                            value="${set.notes}"
                            onchange="updateSetValue('${exercise.id}', ${index}, 'notes', this.value)"
                            placeholder="Notes"
                        />
                    </td>
                    <td>
                        <button class="danger-btn small-btn" onclick="deleteSet('${exercise.id}', ${index})">
                            X
                        </button>
                    </td>
                </tr>
            `;
        });

        let previousHTML = `<div class="previous-week">No previous week data</div>`;

        if (previousExercise) {
            const fadedSets = previousExercise.sets
                .map(
                    (set, i) =>
                        `Set ${i + 1}: ${set.weight || "-"} lb x ${set.reps || "-"} reps`
                )
                .join(" | ");

            previousHTML = `
                <div class="previous-week">
                    Last week: ${fadedSets}
                </div>
            `;
        }

        card.innerHTML = `
            <h3>${exercise.name}</h3>
            <div><strong>Body Part:</strong> ${exercise.bodyPart || "Unknown"}</div>
            <div><strong>Rep Range:</strong> ${exercise.repRange ? `${exercise.repRange.min}-${exercise.repRange.max}` : "-"}</div>
            ${previousHTML}
            <div><strong>Progress Check:</strong> ${progressMessage}</div>
            ${plateauMessage ? `<div style="color: red;"><strong>${plateauMessage}</strong></div>` : ""}
            <div><strong>PR:</strong> ${pr.bestWeight} lb x ${pr.bestReps} reps</div>

            <div class="history-box">
                <strong>History:</strong>
                ${historyHTML || "No history yet"}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Set</th>
                        <th>Reps</th>
                        <th>Weight</th>
                        <th>Notes</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                </tbody>
            </table>

            <div class="inline-group">
                <button class="small-btn" onclick="addSet('${exercise.id}')">+ Add Set</button>
                <button class="small-btn" onclick="renderProgressChart('${exercise.name}')">
                    Show Graph
                </button>
                <button class="secondary-btn small-btn" onclick="editExercise('${exercise.id}')">
                    Edit Exercise
                </button>
                <button class="danger-btn small-btn" onclick="deleteExercise('${exercise.id}')">
                    Delete Exercise
                </button>
            </div>
        `;

        exerciseList.appendChild(card);
    });
}

// ===== INITIAL LOAD =====
updateAuthUI();

loadRoutines().catch(error => {
    console.error(error);
    renderHomePage();
});