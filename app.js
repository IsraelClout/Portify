const form = document.getElementById("portfolioForm");
const savePortfolioButton = document.getElementById("save-portfolio-btn");
const savePortfolioMessage = document.getElementById("save-portfolio-message");
const publicPortfolioMessage = document.getElementById("public-portfolio-message");
const portfolioSelect = document.getElementById("portfolio-select");
const newPortfolioButton = document.getElementById("new-portfolio-btn");
const deletePortfolioButton = document.getElementById("delete-portfolio-btn");
const slugField = document.getElementById("portfolio-slug");
const publishedField = document.getElementById("portfolio-published");
const shareLink = document.getElementById("portfolio-share-link");
const publicSlug = new URLSearchParams(window.location.search).get("portfolio");

const fields = {
  name: document.getElementById("name"),
  role: document.getElementById("role"),
  bio: document.getElementById("bio"),
  skills: document.getElementById("skills"),
  projects: document.getElementById("project"),
  email: document.getElementById("email"),
  template: document.getElementById("template")
};

let activePortfolioId = null;
let currentUser = null;
let publicView = Boolean(publicSlug);

function parseProjects(value) {
  return value
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const separator = line.indexOf("—");
      const name = (separator < 0 ? line : line.slice(0, separator)).trim();
      const description = separator < 0
        ? ""
        : line.slice(separator + 1).trim();
      return name ? { name, description } : null;
    })
    .filter(Boolean);
}

function getPortfolioData() {
  return {
    full_name: fields.name.value.trim(),
    role: fields.role.value.trim(),
    bio: fields.bio.value.trim(),
    email: fields.email.value.trim(),
    skills: fields.skills.value
      .split(",")
      .map(skill => skill.trim())
      .filter(Boolean)
      .slice(0, 12),
    projects: parseProjects(fields.projects.value),
    template: fields.template.value,
    slug: slugField.value.trim(),
    is_published: publishedField.checked
  };
}

function formatProjects(projects) {
  if (!Array.isArray(projects)) return "";
  return projects
    .map(project => {
      if (typeof project === "string") return project;
      if (!project || typeof project !== "object") return "";
      const name = typeof project.name === "string" ? project.name : "";
      const description = typeof project.description === "string"
        ? project.description
        : "";
      return description ? `${name} — ${description}` : name;
    })
    .filter(Boolean)
    .join("\n");
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

function applyPortfolioData(data = {}) {
  fields.name.value = data.full_name || "";
  fields.role.value = data.role || "";
  fields.bio.value = data.bio || "";
  fields.skills.value = Array.isArray(data.skills)
    ? data.skills.join(", ")
    : "";
  fields.projects.value = formatProjects(data.projects);
  if (!data.projects && data.project_name) {
    fields.projects.value = data.project_name;
  }
  fields.email.value = data.email || "";
  fields.template.value = data.template || "aurora";
  slugField.value = data.slug || "";
  slugField.dataset.customized = data.slug ? "true" : "false";
  publishedField.checked = Boolean(data.is_published);
  activePortfolioId = data.id || null;
  updatePreview();
  updatePortfolioControls();
}

function updatePortfolioControls() {
  deletePortfolioButton.disabled = !activePortfolioId || publicView;
  portfolioSelect.disabled = !currentUser || publicView;
  newPortfolioButton.disabled = !currentUser || publicView;
  savePortfolioButton.disabled = publicView;
  slugField.disabled = publicView;
  publishedField.disabled = publicView;

  const slug = slugField.value.trim();
  const canShare = Boolean(activePortfolioId && publishedField.checked && slug);
  shareLink.hidden = !canShare;
  if (canShare) {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("portfolio", slug);
    shareLink.href = url.toString();
  }
}

function updatePreview() {
  const name = fields.name.value.trim() || "Your Name";
  const role = fields.role.value.trim() || "Your Programme or Role";
  const bio = fields.bio.value.trim() ||
    "Your story starts here. Tell the world what makes you unique.";
  const email = fields.email.value.trim();

  document.getElementById("previewName").textContent = name;
  document.getElementById("previewRole").textContent = role;
  document.getElementById("previewBio").textContent = bio;
  document.getElementById("avatar").textContent =
    name.charAt(0).toUpperCase();

  const emailLink = document.getElementById("previewEmail");
  emailLink.href = email ? `mailto:${email}` : "#";
  emailLink.style.display = email ? "inline-block" : "none";

  const skills = fields.skills.value
    .split(",")
    .map(skill => skill.trim())
    .filter(Boolean)
    .slice(0, 12);
  const skillContainer = document.getElementById("previewSkills");
  skillContainer.replaceChildren();
  skills.forEach(skill => {
    const item = document.createElement("span");
    item.textContent = skill;
    skillContainer.appendChild(item);
  });

  const projects = parseProjects(fields.projects.value);
  const projectContainer = document.getElementById("previewProjects");
  projectContainer.replaceChildren();
  projects.forEach((project, index) => {
    const card = document.createElement("section");
    card.className = "project-card";
    const label = document.createElement("span");
    label.textContent = index === 0 ? "FEATURED PROJECT" : "PROJECT";
    const heading = document.createElement("h3");
    heading.textContent = project.name;
    card.append(label, heading);
    if (project.description) {
      const description = document.createElement("p");
      description.textContent = project.description;
      card.appendChild(description);
    }
    projectContainer.appendChild(card);
  });

  const preview = document.getElementById("preview");
  preview.classList.remove("aurora", "folio", "mono");
  preview.classList.add(fields.template.value);
  updatePortfolioControls();
}

function showSaveMessage(message, isError = false) {
  savePortfolioMessage.textContent = message;
  savePortfolioMessage.classList.toggle("error", isError);
  publicPortfolioMessage.textContent = publicView ? message : "";
  publicPortfolioMessage.classList.toggle("error", isError);
  publicPortfolioMessage.hidden = !publicView || !message;
}

async function savePortfolio() {
  const supabaseClient = window.supabaseClient;
  if (!supabaseClient) {
    showSaveMessage(
      "Online saving is unavailable. Check your Supabase configuration.",
      true
    );
    return;
  }

  savePortfolioButton.disabled = true;
  showSaveMessage("Saving your portfolio…");

  try {
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    currentUser = sessionData.session?.user || null;

    if (!currentUser) {
      showSaveMessage("Create an account or log in below to save online.", true);
      document.getElementById("account-section").scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      return;
    }

    if (!slugField.value.trim()) {
      slugField.value = slugify(fields.name.value) || "my-portfolio";
    }
    if (!form.reportValidity()) return;

    const portfolio = getPortfolioData();
    const payload = {
      ...portfolio,
      user_id: currentUser.id
    };
    let response;
    if (activePortfolioId) {
      response = await supabaseClient
        .from("portfolios")
        .update(payload)
        .eq("id", activePortfolioId)
        .eq("user_id", currentUser.id)
        .select("id, slug, is_published")
        .single();
    } else {
      response = await supabaseClient
        .from("portfolios")
        .insert(payload)
        .select("id, slug, is_published")
        .single();
    }

    if (response.error) throw response.error;
    activePortfolioId = response.data.id;
    slugField.value = response.data.slug;
    slugField.dataset.customized = "true";
    await loadPortfolios(currentUser, activePortfolioId);
    showSaveMessage(
      response.data.is_published
        ? "Portfolio saved and published."
        : "Portfolio saved privately to your account."
    );
  } catch (error) {
    console.error("Portfolio save failed:", error);
    const message = error.code === "23505"
      ? "That public slug is already in use. Choose another slug."
      : `Could not save your portfolio: ${error.message}`;
    showSaveMessage(message, true);
  } finally {
    savePortfolioButton.disabled = false;
    updatePortfolioControls();
  }
}

async function loadPortfolio(user, portfolioId) {
  const supabaseClient = window.supabaseClient;
  if (!supabaseClient || !user) return;
  currentUser = user;

  try {
    const { data, error } = await supabaseClient
      .from("portfolios")
      .select("id, full_name, role, bio, email, skills, projects, template, slug, is_published, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    portfolioSelect.replaceChildren();
    const newOption = document.createElement("option");
    newOption.value = "";
    newOption.textContent = "New portfolio";
    portfolioSelect.appendChild(newOption);

    data.forEach(portfolio => {
      const option = document.createElement("option");
      option.value = portfolio.id;
      option.textContent = `${portfolio.full_name || "Untitled"} (${portfolio.slug})`;
      portfolioSelect.appendChild(option);
    });

    const selected = data.find(item => item.id === portfolioId) || data[0];
    if (selected) {
      portfolioSelect.value = selected.id;
      applyPortfolioData(selected);
      showSaveMessage("Your saved portfolio has been loaded.");
    } else {
      startNewPortfolio(false);
      showSaveMessage("Create your first portfolio and save it to your account.");
    }
  } catch (error) {
    console.error("Portfolio load failed:", error);
    showSaveMessage(`Could not load your portfolios: ${error.message}`, true);
  }
}

async function loadPortfolios(user, preferredId) {
  await loadPortfolio(user, preferredId);
}

function startNewPortfolio(showMessage = true) {
  portfolioSelect.value = "";
  applyPortfolioData({});
  slugField.dataset.customized = "false";
  if (showMessage) showSaveMessage("New portfolio ready. Save it to your account when finished.");
}

async function deletePortfolio() {
  if (!activePortfolioId || !currentUser) return;
  if (!window.confirm("Delete this portfolio? This cannot be undone.")) return;

  deletePortfolioButton.disabled = true;
  try {
    const { error } = await window.supabaseClient
      .from("portfolios")
      .delete()
      .eq("id", activePortfolioId)
      .eq("user_id", currentUser.id);
    if (error) throw error;
    activePortfolioId = null;
    await loadPortfolios(currentUser);
    showSaveMessage("Portfolio deleted.");
  } catch (error) {
    console.error("Portfolio delete failed:", error);
    showSaveMessage(`Could not delete the portfolio: ${error.message}`, true);
  } finally {
    updatePortfolioControls();
  }
}

function clearPortfolio() {
  currentUser = null;
  activePortfolioId = null;
  portfolioSelect.replaceChildren(new Option("New portfolio", ""));
  startNewPortfolio(false);
  updatePortfolioControls();
  showSaveMessage("You have logged out. Your saved portfolios remain in your account.");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function buildPortfolioHTML(data) {
  const name = data.full_name || "My Portfolio";
  const role = data.role || "Student";
  const bio = data.bio || "Welcome to my portfolio.";
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const palettes = {
    aurora: { bg: "#f7f8f6", accent: "#176b4d", color: "#202b25" },
    folio: { bg: "#f2ede4", accent: "#775537", color: "#2b261f" },
    mono: { bg: "#141615", accent: "#b7db68", color: "#f3f5f2" }
  };
  const palette = palettes[data.template] || palettes.aurora;
  const skillHTML = (data.skills || []).map(skill =>
    `<span>${escapeHTML(skill)}</span>`
  ).join("");
  const projectHTML = projects.map((project, index) => {
    const title = typeof project === "string" ? project : project.name || "";
    const description = typeof project === "object"
      ? project.description || ""
      : "";
    return `<section class="project"><div class="badge">${index === 0 ? "FEATURED PROJECT" : "PROJECT"}</div><h2>${escapeHTML(title)}</h2>${description ? `<p>${escapeHTML(description)}</p>` : ""}</section>`;
  }).join("");
  const contactHTML = data.email
    ? `<a class="contact" href="mailto:${escapeHTML(data.email)}">Contact me ↗</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(name)} | Portfolio</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:30px 18px;background:#edf1ed;font:16px/1.7 Arial,sans-serif;color:#202b25}
main{max-width:760px;margin:40px auto;padding:clamp(24px,6vw,55px);background:${palette.bg};color:${palette.color};border:1px solid rgba(32,43,37,.12);border-radius:10px}
.badge{color:${palette.accent};font-size:12px;letter-spacing:2px}
h1{font-size:clamp(36px,8vw,64px);line-height:1.1;margin:18px 0}
h2{color:${palette.accent};font-size:20px}
p{overflow-wrap:anywhere}
.skills{display:flex;flex-wrap:wrap;gap:8px;margin:25px 0}
.skills span{border:1px solid ${palette.accent};padding:6px 12px;border-radius:30px;font-size:12px}
.project{margin-top:24px;padding:20px;border:1px solid ${palette.accent};border-radius:12px}
.contact{display:inline-block;margin-top:24px;padding:12px 18px;background:${palette.accent};color:#fff;text-decoration:none;border-radius:6px}
footer{margin-top:45px;font-size:11px;opacity:.6}
</style>
</head>
<body>
<main>
<div class="badge">MY PORTFOLIO</div>
<h1>${escapeHTML(name)}</h1>
<h2>${escapeHTML(role)}</h2>
<p>${escapeHTML(bio)}</p>
<div class="skills">${skillHTML}</div>
${projectHTML}
${contactHTML}
<footer>Created with Portify.</footer>
</main>
</body>
</html>`;
}

function downloadPortfolio() {
  const blob = new Blob([buildPortfolioHTML(getPortfolioData())], {
    type: "text/html;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "my-portfolio.html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function showPublicPortfolio(slug) {
  if (!slug) {
    showSaveMessage("This portfolio link is invalid.", true);
    return;
  }

  try {
    const { data, error } = await window.supabaseClient
      .from("portfolios")
      .select("full_name, role, bio, email, skills, projects, template, slug, is_published")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      showSaveMessage("This portfolio was not found or is no longer published.", true);
      return;
    }
    applyPortfolioData(data);
    document.title = `${data.full_name || "Portfolio"} | Portify`;
  } catch (error) {
    console.error("Public portfolio load failed:", error);
    showSaveMessage(`Could not load this portfolio: ${error.message}`, true);
  }
}

function setupPublicView() {
  document.body.classList.add("public-view");
  document.querySelector(".hero").hidden = true;
  document.querySelector(".features").hidden = true;
  document.getElementById("account-section").hidden = true;
  document.querySelector(".editor").hidden = true;
  document.querySelector(".save-row").hidden = true;
  document.querySelector(".section-heading h2").textContent = "Portfolio";
  document.querySelector(".section-heading > p:not(.eyebrow)").textContent =
    "An independently published portfolio on Portify.";
  document.querySelector(".navbar .logo").href = "./";
  const navLink = document.querySelector(".navbar .nav-btn");
  navLink.href = "./";
  navLink.textContent = "Create your portfolio";
}

form.addEventListener("submit", event => {
  event.preventDefault();
  updatePreview();
});

Object.values(fields).forEach(field => {
  field.addEventListener("input", updatePreview);
  field.addEventListener("change", updatePreview);
});

fields.name.addEventListener("input", () => {
  if (slugField.dataset.customized !== "true") {
    slugField.value = slugify(fields.name.value);
    updatePortfolioControls();
  }
});
slugField.addEventListener("input", () => {
  slugField.value = slugField.value.toLowerCase();
  slugField.dataset.customized = "true";
  updatePortfolioControls();
});
publishedField.addEventListener("change", updatePortfolioControls);
portfolioSelect.addEventListener("change", () => {
  if (!portfolioSelect.value) {
    startNewPortfolio();
    return;
  }
  if (currentUser) loadPortfolio(currentUser, portfolioSelect.value);
});
newPortfolioButton.addEventListener("click", () => startNewPortfolio());
deletePortfolioButton.addEventListener("click", deletePortfolio);
savePortfolioButton.addEventListener("click", savePortfolio);
document.getElementById("downloadBtn").addEventListener("click", downloadPortfolio);

window.portifyApp = {
  clearPortfolio,
  isPublicView: publicView,
  loadPortfolio: loadPortfolios
};

updatePreview();
if (publicView) {
  setupPublicView();
  if (window.supabaseClient) {
    showPublicPortfolio(publicSlug);
  } else {
    showSaveMessage("Published portfolios are unavailable. Check the Supabase configuration.", true);
  }
}
