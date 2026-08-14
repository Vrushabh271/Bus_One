document.addEventListener("DOMContentLoaded", () => {

  const API = `${window.location.protocol}//${window.location.hostname}:5000`;

  // ==============================
  // ELEMENTS
  // ==============================

  const statNumbers = document.querySelectorAll(".stat-card h3");

  // ==============================
  // LOAD DASHBOARD DATA
  // ==============================

  async function loadDashboard() {
    try {

      const [busesResponse, driversResponse, passengersResponse] =
        await Promise.all([
          fetch(`${API}/buses`),
          fetch(`${API}/drivers`),
          fetch(`${API}/passengers`)
        ]);

      if (!busesResponse.ok ||
          !driversResponse.ok ||
          !passengersResponse.ok) {
        throw new Error("Failed to load dashboard data");
      }

      const busesData = await busesResponse.json();
      const driversData = await driversResponse.json();
      const passengersData = await passengersResponse.json();

      // Total Buses
      if (statNumbers[0]) {
        statNumbers[0].textContent =
          busesData.buses?.length || 0;
      }

      // Total Drivers
      if (statNumbers[1]) {
        statNumbers[1].textContent =
          driversData.drivers?.length || 0;
      }

      // Total Passengers
      if (statNumbers[2]) {
        statNumbers[2].textContent =
          passengersData.passengers?.length || 0;
      }

      // Active Passes
      // Pass API later add karenge.
      // Abhi safe default.
      if (statNumbers[3]) {
        statNumbers[3].textContent = "0";
      }

      console.log("Dashboard data loaded successfully.");

    } catch (error) {

      console.error("Dashboard Error:", error);

    }
  }


  // ==============================
  // CHECK LOGIN
  // ==============================

  const savedUser = localStorage.getItem("busOneUser");

  if (!savedUser) {
    window.location.href = "index.html";
    return;
  }

  let currentUser;

  try {
    currentUser = JSON.parse(savedUser);
  } catch (error) {
    console.error("Invalid user data.");
    localStorage.removeItem("busOneUser");
    window.location.href = "index.html";
    return;
  }


  // ==============================
  // ADMIN CHECK
  // ==============================

  if (currentUser.role !== "admin") {

    alert("Access denied. Admin account required.");

    window.location.href = "index.html";

    return;
  }


  // ==============================
  // UPDATE ADMIN NAME
  // ==============================

  const welcomeHeading = document.querySelector(
    ".p-4 h2"
  );

  if (welcomeHeading && currentUser.full_name) {

    welcomeHeading.textContent =
      `Welcome back, ${currentUser.full_name} 👋`;

  }


  // ==============================
  // UPDATE PROFILE INITIAL
  // ==============================

  const profileCircle =
    document.querySelector(".profile-circle");

  if (profileCircle && currentUser.full_name) {

    profileCircle.textContent =
      currentUser.full_name
        .charAt(0)
        .toUpperCase();

  }


  // ==============================
  // LOGOUT
  // ==============================

  const logoutBtn =
    document.getElementById("logoutBtn");

  if (logoutBtn) {

    logoutBtn.addEventListener("click", () => {

      localStorage.removeItem("busOneUser");

      window.location.href = "index.html";

    });

  }


  // ==============================
  // LOAD DATA
  // ==============================

  loadDashboard();

});