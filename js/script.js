const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const closeBtn = document.getElementById("closeBtn");

menuBtn.addEventListener("click", () => {
    sidebar.classList.add("open");
});

closeBtn.addEventListener("click", () => {
    sidebar.classList.remove("open");
});

// ==========================
// Experience Tabs
// ==========================

const tabs = document.querySelectorAll(".tab-btn");
const contents = document.querySelectorAll(".tab-content");

const pageTitle = document.getElementById("page-title");
const pageDescription = document.getElementById("page-description");

tabs.forEach(tab => {

    tab.addEventListener("click", () => {

        tabs.forEach(btn => btn.classList.remove("active"));
        contents.forEach(content => content.classList.remove("active"));

        tab.classList.add("active");
        document.getElementById(tab.dataset.tab).classList.add("active");

        if (tab.dataset.tab === "professional") {

            pageTitle.textContent = "Professional Experience";
            pageDescription.textContent =
                "My professional experience spans software engineering, embedded systems, data visualization, and digital media.";

        }

        else if (tab.dataset.tab === "leadership") {

            pageTitle.textContent = "Leadership Experience";
            pageDescription.textContent =
                "Leadership roles where I have organized communities, managed teams, and led initiatives across campus organizations.";

        }

        else if (tab.dataset.tab === "volunteer") {

            pageTitle.textContent = "Campus Experience";
            pageDescription.textContent =
                "Technical competitions, design teams, and student involvement that have strengthened my engineering and leadership skills.";

        }

    });

});

// ==========================
// Hide Explore on Scroll
// ==========================

const scrollIndicator = document.querySelector(".scroll-indicator");

if (scrollIndicator) {

    window.addEventListener("scroll", () => {

        if (window.scrollY > 80) {
            scrollIndicator.classList.add("hide");
        } else {
            scrollIndicator.classList.remove("hide");
        }

    });

}