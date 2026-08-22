const form = document.querySelector("#contact-form");
const status = document.querySelector("#contact-status");
const submit = form.querySelector('button[type="submit"]');

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) return;

  const endpoint = window.AGENT_PAIR_CONTACT_ENDPOINT;
  if (!endpoint) {
    status.dataset.state = "error";
    status.textContent = "The contact form is temporarily unavailable. Please try again later.";
    return;
  }

  submit.disabled = true;
  submit.textContent = "Sending…";
  status.dataset.state = "pending";
  status.textContent = "Sending your message…";

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) throw new Error(result.message || "Your message could not be sent.");

    form.reset();
    status.dataset.state = "success";
    status.textContent = result.message || "Thanks — your message has been sent.";
  } catch (error) {
    status.dataset.state = "error";
    status.textContent = error.message || "Your message could not be sent. Please try again.";
  } finally {
    submit.disabled = false;
    submit.textContent = "Send message";
  }
});
