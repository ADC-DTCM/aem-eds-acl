export default function decorate(block) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('feedback-wrapper');

  const question = document.createElement('p');
  question.classList.add('feedback-question');
  question.textContent = 'Was this information helpful?';

  const buttons = document.createElement('div');
  buttons.classList.add('feedback-buttons');

  const yesBtn = document.createElement('button');
  yesBtn.classList.add('primary');
  yesBtn.textContent = 'Yes';
  yesBtn.setAttribute('aria-label', 'Yes, this was helpful');

  const noBtn = document.createElement('button');
  noBtn.classList.add('primary');
  noBtn.textContent = 'No';
  noBtn.setAttribute('aria-label', 'No, this was not helpful');

  const thankYou = document.createElement('p');
  thankYou.classList.add('feedback-thankyou');
  thankYou.textContent = 'Thanks for your feedback – it\'s been sent to our web team.';
  thankYou.setAttribute('aria-live', 'polite');

  // negative feedback form
  const negativeFeedback = document.createElement('div');
  negativeFeedback.classList.add('feedback-negative');
  negativeFeedback.setAttribute('aria-live', 'polite');

  const negativeTitle = document.createElement('p');
  negativeTitle.classList.add('feedback-negative-title');
  negativeTitle.textContent = 'Page-level feedback';

  const negativeLabel = document.createElement('p');
  negativeLabel.classList.add('feedback-negative-label');
  negativeLabel.textContent = 'Sorry about that. How can we improve the information?';

  const negativeTextarea = document.createElement('textarea');
  negativeTextarea.classList.add('feedback-negative-textarea');
  negativeTextarea.setAttribute('rows', '4');
  negativeTextarea.setAttribute('aria-label', 'How can we improve the information?');

  const submitBtn = document.createElement('button');
  submitBtn.classList.add('primary', 'feedback-submit');
  submitBtn.textContent = 'Submit';

  negativeFeedback.append(negativeTitle, negativeLabel, negativeTextarea, submitBtn);

  function handleFeedback(value) {
    if (value === 'yes') {
      thankYou.textContent = 'Great - thanks for your feedback.';
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
    thankYou.textContent = 'Thanks for your feedback \u2013 it\u2019s been sent to our web team.';
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
