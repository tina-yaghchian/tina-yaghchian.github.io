document.addEventListener("DOMContentLoaded", () => {

    const button = document.getElementById("theme-toggle");

    if (!button) return;

    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "light") {
        document.documentElement.setAttribute("data-theme", "light");
    }

    updateIcon();

    button.addEventListener("click", () => {

        const light =
            document.documentElement.getAttribute("data-theme") === "light";

        if (light) {

            document.documentElement.removeAttribute("data-theme");
            localStorage.setItem("theme", "dark");

        } else {

            document.documentElement.setAttribute("data-theme", "light");
            localStorage.setItem("theme", "light");

        }

        updateIcon();

    });

    function updateIcon() {

        const light =
            document.documentElement.getAttribute("data-theme") === "light";

        button.textContent = light ? "☀️" : "🌙";

    }

});