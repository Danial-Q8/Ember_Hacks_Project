const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

// open file picker
dropZone.addEventListener('click', () => fileInput.click());

// choosing file manually
fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
})

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => e.preventDefault());
  document.body.addEventListener(eventName, (e) => e.preventDefault());
});

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'));
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'));
});

// Handle dropped files
dropZone.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  handleFiles(files);
});

// Handle file(s)
function handleFiles(files) {
  for (let file of files) {
    console.log('File dropped:', file.name);
    uploadFile(file);
  }
}

// Example upload function
function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  fetch('/upload', { // your server endpoint
    method: 'POST',
    body: formData
  })
  .then(response => response.text())
  .then(result => console.log('Success:', result))
  .catch(error => console.error('Error:', error));
}

