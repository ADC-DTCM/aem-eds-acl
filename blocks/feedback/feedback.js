const DEFAULTS = {
  question: 'Was this information helpful?',
  yesLabel: 'Yes',
  noLabel: 'No',
  negativeTitle: 'Page-level feedback',
  negativeLabel: 'Sorry about that. How can we improve the information?',
  submitLabel: 'Submit',
  yesMessage: 'Thanks for your feedback!',
  noMessage: 'Thanks for your feedback!',
};

function parseBlockContent(block) {
  const rows = [...block.children];
  if (!rows.length) return {};
  const cells = rows.map((row) => {
    const cell = row.querySelector('div');
    return cell ? cell.textContent.trim() : '';
  }).filter(Boolean);
  if (!cells.length) return {};
  const [question, heading, prompt, thanks] = cells;
  const parsed = {};
  if (question) parsed.question = question;
  if (heading) parsed.negativeTitle = heading;
  if (prompt) parsed.negativeLabel = prompt;
  if (thanks) {
    parsed.yesMessage = thanks;
    parsed.noMessage = thanks;
  }
  return parsed;
}

export default function decorate(block, content = {}) {
  // if no content passed, parse from block DOM (standalone block)
  const authored = Object.keys(content).length ? content : parseBlockContent(block);
  const config = { ...DEFAULTS, ...authored };
  const wrapper = document.createElement('div');
  wrapper.classList.add('feedback-wrapper');

  const question = document.createElement('p');
  question.classList.add('feedback-question');
  question.textContent = config.question;

  const buttons = document.createElement('div');
  buttons.classList.add('feedback-buttons');

  const yesBtn = document.createElement('button');
  yesBtn.classList.add('primary');
  yesBtn.textContent = config.yesLabel;
  yesBtn.setAttribute('aria-label', config.yesLabel);

  const noBtn = document.createElement('button');
  noBtn.classList.add('primary');
  noBtn.textContent = config.noLabel;
  noBtn.setAttribute('aria-label', config.noLabel);

  const thankYou = document.createElement('p');
  thankYou.classList.add('feedback-thankyou');
  thankYou.setAttribute('aria-live', 'polite');

  // negative feedback form
  const negativeFeedback = document.createElement('div');
  negativeFeedback.classList.add('feedback-negative');
  negativeFeedback.setAttribute('aria-live', 'polite');

  const negativeTitle = document.createElement('p');
  negativeTitle.classList.add('feedback-negative-title');
  negativeTitle.textContent = config.negativeTitle;

  const negativeLabel = document.createElement('p');
  negativeLabel.classList.add('feedback-negative-label');
  negativeLabel.textContent = config.negativeLabel;

  const negativeTextarea = document.createElement('textarea');
  negativeTextarea.classList.add('feedback-negative-textarea');
  negativeTextarea.setAttribute('rows', '4');
  negativeTextarea.setAttribute('aria-label', config.negativeLabel);

  const submitBtn = document.createElement('button');
  submitBtn.classList.add('primary', 'feedback-submit');
  submitBtn.textContent = config.submitLabel;

  negativeFeedback.append(negativeTitle, negativeLabel, negativeTextarea, submitBtn);

  function handleFeedback(value) {
    if (value === 'yes') {
      thankYou.textContent = config.yesMessage;
      wrapper.classList.add('feedback-submitted');
      // send feedback event to Google Analytics
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'page_feedback', {
          feedback_value: value,
          page_path: window.location.pathname,
        });
      }
    } else {
      wrapper.classList.add('feedback-negative-open');
    }
  }

  submitBtn.addEventListener('click', () => {
    const comment = negativeTextarea.value.trim();
    thankYou.textContent = config.noMessage;
    wrapper.classList.remove('feedback-negative-open');
    wrapper.classList.add('feedback-submitted');
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_feedback', {
        feedback_value: 'no',
        feedback_comment: comment,
        page_path: window.location.pathname,
      });
    }
  });

  yesBtn.addEventListener('click', () => handleFeedback('yes'));
  noBtn.addEventListener('click', () => handleFeedback('no'));

  buttons.append(yesBtn, noBtn);
  wrapper.append(question, buttons, negativeFeedback, thankYou);

  block.textContent = '';
  block.append(wrapper);
}
