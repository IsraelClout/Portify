const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("auth-email");
const passwordInput = document.getElementById("auth-password");
const passwordLabel = document.getElementById("auth-password-label");
const authMessage = document.getElementById("auth-message");
const accountDescription = document.getElementById("account-description");
const signupBtn = document.getElementById("signup-btn");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const supabaseClient = window.supabaseClient;

function showAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("error", isError);
}

function updateAuthUI(user) {
  const loggedIn = Boolean(user);
  signupBtn.hidden = loggedIn;
  loginBtn.hidden = loggedIn;
  logoutBtn.hidden = !loggedIn;
  emailInput.disabled = loggedIn;
  passwordLabel.hidden = loggedIn;
  passwordInput.hidden = loggedIn;
  passwordInput.required = !loggedIn;
  if (loggedIn) {
    emailInput.value = user.email || "";
    passwordInput.value = "";
    accountDescription.textContent = `Signed in as ${user.email}. Your portfolio is private to your account.`;
  } else {
    accountDescription.textContent =
      "Create an account or log in to save your portfolio securely online.";
  }
}

async function signUp() {
  const { data, error } = await supabaseClient.auth.signUp({
    email: emailInput.value.trim(),
    password: passwordInput.value
  });
  if (error) throw error;

  if (data.session) {
    showAuthMessage("Account created and signed in.");
  } else {
    showAuthMessage("Account created. Check your email to confirm your address, then log in.");
  }
}

async function logIn() {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value
  });
  if (error) throw error;

  updateAuthUI(data.user);
  showAuthMessage("Logged in successfully.");
}

async function logOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;

  updateAuthUI(null);
  showAuthMessage("You have logged out.");
}

if (!supabaseClient) {
  signupBtn.disabled = true;
  loginBtn.disabled = true;
  showAuthMessage(
    "Authentication is unavailable. Check the Supabase URL and publishable key in config.js.",
    true
  );
} else {
  authForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!authForm.reportValidity()) return;

    signupBtn.disabled = true;
    try {
      await signUp();
    } catch (error) {
      console.error("Account creation failed:", error);
      showAuthMessage(error.message, true);
    } finally {
      signupBtn.disabled = false;
    }
  });

  loginBtn.addEventListener("click", async () => {
    if (!authForm.reportValidity()) return;

    loginBtn.disabled = true;
    try {
      await logIn();
    } catch (error) {
      console.error("Login failed:", error);
      showAuthMessage(error.message, true);
    } finally {
      loginBtn.disabled = false;
    }
  });

  logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    try {
      await logOut();
    } catch (error) {
      console.error("Logout failed:", error);
      showAuthMessage(error.message, true);
    } finally {
      logoutBtn.disabled = false;
    }
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    const user = session?.user || null;
    updateAuthUI(user);
    if (event === "SIGNED_IN" && user && !window.portifyApp.isPublicView) {
      window.setTimeout(() => window.portifyApp.loadPortfolio(user), 0);
    } else if (event === "SIGNED_OUT" && !window.portifyApp.isPublicView) {
      window.portifyApp.clearPortfolio();
    }
  });

  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Session restore failed:", error);
      showAuthMessage("Could not restore your sign-in session. Please log in again.", true);
      updateAuthUI(null);
      return;
    }

    const user = data.session?.user || null;
    updateAuthUI(user);
    if (user && !window.portifyApp.isPublicView) {
      window.portifyApp.loadPortfolio(user);
    }
  }).catch(error => {
    console.error("Session restore failed:", error);
    showAuthMessage("Could not restore your sign-in session. Please log in again.", true);
    updateAuthUI(null);
  });
}
