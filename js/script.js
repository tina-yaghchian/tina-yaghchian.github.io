const sidebar = document.getElementById("sidebar");

const menuBtn = document.querySelector(".menu-btn");

const closeBtn = document.getElementById("closeBtn");

menuBtn.addEventListener("click", () => {

    sidebar.classList.add("open");

});

closeBtn.addEventListener("click", () => {

    sidebar.classList.remove("open");

});