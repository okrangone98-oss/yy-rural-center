document.addEventListener("DOMContentLoaded", function () {
  // year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Teachers
  if (window.TeachersModule) {
    window.TeachersModule.bindFilterButtons();
    window.TeachersModule.load();
  }

  // Notices
  if (window.NoticesModule) {
    window.NoticesModule.load();
  }

  // Videos
  if (window.VideosModule) {
    window.VideosModule.load();
  }

  // Programs (연도 탭 포함)
  if (window.ProgramsModule) {
    window.ProgramsModule.init();
  }

  // PD (연도 탭 포함)
  if (window.PDModule) {
    window.PDModule.init();
  }
});
