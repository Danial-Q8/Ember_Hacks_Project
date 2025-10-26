/*const dropZone = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById("fileName");
const resultDisplay = document.getElementById("result");

// open file picker
dropZone.addEventListener('click', () => fileInput.click());

// Handle file selection
fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    fileNameDisplay.textContent = "Selected: " + fileInput.files[0].name;
  }
});

// Prevent default drag behaviors
["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
  uploadBox.addEventListener(eventName, e => e.preventDefault());
  uploadBox.addEventListener(eventName, e => e.stopPropagation());
});

// Highlight box when dragging
uploadBox.addEventListener("dragover", () => {
  uploadBox.classList.add("dragover");
});

// Remove highlight when not dragging
uploadBox.addEventListener("dragleave", () => {
  uploadBox.classList.remove("dragover");
});

// Handle drop
uploadBox.addEventListener("drop", e => {
  uploadBox.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    fileInput.files = files;
    fileNameDisplay.textContent = "Dropped: " + files[0].name;
  }
});


document.getElementById("uploadBtn").addEventListener("click", async () => {
  event.stopPropagation();
  if (!fileInput.files.length) {
    alert("Please choose or drop a file first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  resultDisplay.textContent = "Processing... please wait ⏳";

  try {
    const res = await fetch("http://localhost:3000/upload", {
      method: "POST",
      body: formData
    });



    const data = await res.json();
    resultDisplay.textContent = "Detected Year: " + data.year;
  } catch (error) {
    console.error(error);
    resultDisplay.textContent = "❌ Error detecting year. Please try again.";
  }
});*/

const dropZone = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById("fileName");
const resultDisplay = document.getElementById("result");
const uploadBox = document.getElementById('uploadBox'); // Ensure this is defined

// open file picker
dropZone.addEventListener('click', () => fileInput.click());

// Handle file selection
fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    fileNameDisplay.textContent = "Selected: " + fileInput.files[0].name;
  }
});

// Prevent default drag behaviors
["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
  uploadBox.addEventListener(eventName, e => e.preventDefault());
  uploadBox.addEventListener(eventName, e => e.stopPropagation());
});

// Highlight box when dragging
uploadBox.addEventListener("dragover", () => {
  uploadBox.classList.add("dragover");
});

// Remove highlight when not dragging
uploadBox.addEventListener("dragleave", () => {
  uploadBox.classList.remove("dragover");
});

// Handle drop
uploadBox.addEventListener("drop", e => {
  uploadBox.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    fileInput.files = files;
    fileNameDisplay.textContent = "Dropped: " + files[0].name;
  }
});


document.getElementById("uploadBtn").addEventListener("click", async (event) => {
  event.stopPropagation(); // ⬅️ FIX 1: Ensure event is stopped here

  if (!fileInput.files.length) {
    alert("Please choose or drop a file first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  resultDisplay.textContent = "Processing... please wait ⏳";

  try {
    const res = await fetch("http://localhost:3000/upload", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
        // Check for non-200 responses
        throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json(); // ⬅️ FIX 2: Ensure this has no arguments
    
    // Check if the response actually contains the 'year' field
    if (data && data.year) {
        resultDisplay.textContent = "Detected Year: " + data.year;
    } else {
        resultDisplay.textContent = "❌ Error: Response missing 'year' data.";
    }
    
  } catch (error) {
    console.error("Fetch/Processing Error:", error);
    resultDisplay.textContent = `❌ Error detecting year: ${error.message || 'Unknown error.'}`;
  }
});
