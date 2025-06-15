// --- DOM Elements ---
const jokeTextElement = document.getElementById('jokeText');
const jokeDisplayCard = document.getElementById('jokeDisplay'); 
const gimmeJokeButton = document.getElementById('gimmeJokeButton');
const loaderElement = document.getElementById('loader'); 
const messageBox = document.getElementById('messageBox');
const basedModeCheckbox = document.getElementById('basedModeCheckbox');
const volumeSlider = document.getElementById('volumeSlider');

// Modal Elements
const warningModal = document.getElementById('warningModal');
const acceptWarningBtn = document.getElementById('acceptWarningBtn');

// --- Sound Effects Setup (Tone.js) ---
let synth, drumSynth, metalSynth;
function initializeSounds() {
    if (!synth) { 
        synth = new Tone.Synth().toDestination();
        drumSynth = new Tone.MembraneSynth().toDestination();
        metalSynth = new Tone.MetalSynth({
            frequency: 250, envelope: { attack: 0.001, decay: 1.4, release: 0.2 },
            harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5
        }).toDestination();
        metalSynth.volume.value = -12;
    }
}

function playButtonClickSound() { if (!synth) return; synth.triggerAttackRelease("C5", "8n"); }
function playToggleSound(isChecked) { if (!synth) return; isChecked ? synth.triggerAttackRelease("E5", "16n") : synth.triggerAttackRelease("C5", "16n"); }
function playSetupSound() { if (!synth) return; const now = Tone.now(); synth.triggerAttackRelease("C4", "16n", now); synth.triggerAttackRelease("E4", "16n", now + 0.1); synth.triggerAttackRelease("G4", "16n", now + 0.2); }
function playPunchlineSound() { if (!drumSynth || !metalSynth) return; const now = Tone.now(); drumSynth.triggerAttackRelease("G2", "8n", now); drumSynth.triggerAttackRelease("D2", "8n", now + 0.15); metalSynth.triggerAttackRelease("C5", "2n", now + 0.3); }
function playErrorSound() { if (!synth) return; const now = Tone.now(); synth.triggerAttackRelease("C3", "8n", now); synth.triggerAttackRelease("G2", "8n", now + 0.2); }
function playWarningSound() { if (!synth) return; synth.triggerAttackRelease("A3", "4n"); }

// --- Joke API Configuration ---
const API_URL_CORE = "https://v2.jokeapi.dev/joke/Any?type=single,twopart"; 
const DESIRED_BASED_FLAGS = ["nsfw", "religious", "political", "racist", "sexist", "explicit"]; 
const MAX_BASED_FETCH_RETRIES = 5; 
const PUNCHLINE_DELAY = 1000; 

// --- Functions ---
function showMessage(message, type = 'error') {
    if (type === 'error' || type === 'info') playErrorSound();
    messageBox.textContent = message;
    messageBox.className = 'message-box'; 
    messageBox.classList.add(type); 
    messageBox.classList.add('show'); 
    setTimeout(() => { messageBox.classList.remove('show'); }, 4000); 
}

function getApiUrl() {
    if (basedModeCheckbox.checked) return API_URL_CORE;
    else return `${API_URL_CORE}&safe-mode`;
}

async function fetchJoke(retryCount = 0) {
    loaderElement.classList.remove('hidden'); 
    if (retryCount === 0) jokeTextElement.innerHTML = 'Thinking of a good one...';
    jokeDisplayCard.classList.remove('new-joke-animation'); 

    const currentApiUrl = getApiUrl();
    console.log(`Fetching joke from: ${currentApiUrl} (Attempt ${retryCount + 1})`);

    try {
        const response = await fetch(currentApiUrl);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();

        if (data.error === true) {
            let msg = data.message || "API returned an error.";
            jokeTextElement.textContent = msg;
            showMessage(msg, "error");
            loaderElement.classList.add('hidden');
            return;
        }
        
        if (basedModeCheckbox.checked) {
            const jokeFlags = data.flags || {}; 
            const isBasedEnough = DESIRED_BASED_FLAGS.some(flag => jokeFlags[flag] === true);
            if (!isBasedEnough) {
                if (retryCount < MAX_BASED_FETCH_RETRIES - 1) {
                    if (retryCount === 0) jokeTextElement.innerHTML = 'Seeking an extra based joke...';
                    fetchJoke(retryCount + 1); 
                    return; 
                } else {
                    let msg = "Tried hard, but couldn't find a sufficiently based joke right now! 🤷";
                    jokeTextElement.textContent = msg;
                    showMessage(msg, "error");
                    loaderElement.classList.add('hidden'); 
                    return;
                }
            }
        }
        
        setTimeout(() => { jokeDisplayCard.classList.add('new-joke-animation'); }, 0);
        displayJoke(data); 

    } catch (error) { 
        console.error("Fetch failed:", error); 
        let msg = "Oops! Could not fetch a joke. Please try again.";
        jokeTextElement.textContent = msg; 
        showMessage(msg, "error"); 
        loaderElement.classList.add('hidden'); 
    } 
}

function displayJoke(jokeData) {
    jokeTextElement.innerHTML = ''; 

    if (jokeData.type === 'single' && typeof jokeData.joke === 'string') { 
        playSetupSound();
        jokeTextElement.textContent = jokeData.joke;
        loaderElement.classList.add('hidden'); 
    } else if (jokeData.type === 'twopart' && typeof jokeData.setup === 'string' && typeof jokeData.delivery === 'string') { 
        const setupSpan = document.createElement('span');
        setupSpan.className = 'setup';
        setupSpan.textContent = jokeData.setup;
        jokeTextElement.appendChild(setupSpan);
        playSetupSound();
        
        jokeTextElement.appendChild(document.createElement('br'));

        const deliverySpan = document.createElement('span');
        deliverySpan.className = 'delivery'; 
        deliverySpan.textContent = jokeData.delivery;
        jokeTextElement.appendChild(deliverySpan);

        loaderElement.classList.add('hidden'); 

        setTimeout(() => {
            playPunchlineSound();
            deliverySpan.style.visibility = 'visible';
            void deliverySpan.offsetWidth; 
            deliverySpan.style.animation = 'fadeIn 0.8s ease-out forwards';
        }, PUNCHLINE_DELAY);

    } else {
        jokeTextElement.textContent = 'Oops! The joke format was a bit weird.';
        showMessage("Received an unusual joke format from the API.", "error");
        loaderElement.classList.add('hidden'); 
    }
}

function setVolume(value) {
    if (Tone && Tone.Destination) {
        const volumeInDb = Tone.gainToDb(value / 100);
        Tone.Destination.volume.value = volumeInDb;
    }
    volumeSlider.style.backgroundSize = `${value}% 100%`;
}

// --- Event Listeners ---
function startAudioContext() {
    if (Tone.context.state !== 'running') {
        return Tone.start().then(() => {
            console.log("Audio context started.");
            initializeSounds();
            setVolume(volumeSlider.value); 
        });
    }
    if (!synth) {
        initializeSounds();
        setVolume(volumeSlider.value);
    }
    return Promise.resolve();
}

gimmeJokeButton.addEventListener('click', () => {
    startAudioContext().then(() => {
        playButtonClickSound();
        gimmeJokeButton.style.animation = 'none';
        void gimmeJokeButton.offsetWidth; 
        gimmeJokeButton.style.animation = 'buttonBoing 0.3s ease-out';
        fetchJoke(); 
    });
});

basedModeCheckbox.addEventListener('change', (event) => {
    startAudioContext().then(() => {
        const isChecked = event.target.checked;
        
        if (isChecked) {
            event.preventDefault();
            warningModal.classList.add('show');
            playWarningSound();
            return;
        } else {
            playToggleSound(false);
            localStorage.setItem('basedModeActive', false);
            fetchJoke();
        }
    });
});

acceptWarningBtn.addEventListener('click', () => {
    startAudioContext().then(() => {
        warningModal.classList.remove('show');
        basedModeCheckbox.checked = true;
        playToggleSound(true);
        localStorage.setItem('basedModeActive', true);
        fetchJoke();
    });
});

volumeSlider.addEventListener('input', (event) => {
    const value = event.target.value;
    startAudioContext().then(() => {
        setVolume(value);
    });
    localStorage.setItem('jokeVolume', value);
});

// --- Initialization ---
function initializeApp() {
    const savedBasedMode = localStorage.getItem('basedModeActive');
    if (savedBasedMode !== null) {
        basedModeCheckbox.checked = (savedBasedMode === 'true');
    }

    const savedVolume = localStorage.getItem('jokeVolume');
    let initialVolume = 100;
    if (savedVolume !== null) {
        initialVolume = parseInt(savedVolume, 10);
    }
    volumeSlider.value = initialVolume;
    volumeSlider.style.backgroundSize = `${initialVolume}% 100%`;
    
    jokeTextElement.innerHTML = 'Press the big button to get a joke!';
}

document.addEventListener('DOMContentLoaded', initializeApp);
