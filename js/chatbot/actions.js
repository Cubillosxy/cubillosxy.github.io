const WHATSAPP_NUMBER = '573185229619';


export function triggerDownloadCV() {
  const a = document.createElement('a');
  a.href = './Profile.pdf';
  a.download = 'Edwin_Cubillos_Resume.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Opens a pre-filled WhatsApp conversation with Edwin.
 * @param {string} name - The recruiter's name (captured by the chatbot flow)
 */
export function triggerWhatsApp(name) {
  const greeting = name
    ? 'Hey Edwin, it\'s ' + name + '! I\'m contacting you through your portfolio chatbot.'
    : 'Hey Edwin! I found your contact through your portfolio chatbot.';

  const url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(greeting);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Opens Edwin's Calendly coffee chat scheduler in a new tab.
 */
export function triggerBookMeeting() {
  window.open('https://calendly.com/cubillos-dev-bk/coffee-with-edwin', '_blank', 'noopener,noreferrer');
}
