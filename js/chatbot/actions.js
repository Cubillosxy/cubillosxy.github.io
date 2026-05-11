export function triggerDownloadCV() {
  // Create a temporary link element to trigger the download
  const a = document.createElement('a');
  a.href = './Profile.pdf'; // Path to CV
  a.download = 'Edwin_Cubillos_Resume.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
