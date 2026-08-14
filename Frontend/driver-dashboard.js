document.addEventListener("DOMContentLoaded", async () => {

    const API = `${window.location.protocol}//${window.location.hostname}:5000`;

    // =========================
    // GET LOGGED-IN DRIVER
    // =========================

    const storedUser = localStorage.getItem("busOneUser");

    if (!storedUser) {
        alert("Please login first.");
        window.location.href = "index.html";
        return;
    }

    let user;

    try {
        user = JSON.parse(storedUser);
    } catch (error) {
        localStorage.removeItem("busOneUser");
        window.location.href = "index.html";
        return;
    }

    if (!user.id || user.role !== "driver") {
        alert("Driver account required.");
        window.location.href = "index.html";
        return;
    }


    // =========================
    // ELEMENTS
    // =========================

    const assignedBus = document.getElementById("assignedBus");
    const assignedRoute = document.getElementById("assignedRoute");
    const profileInitial = document.getElementById("profileInitial");
    const driverGreeting = document.getElementById("driverGreeting");

    const generateQrBtn = document.getElementById("generateQrBtn");
    const qrContainer = document.getElementById("qrContainer");
    const qrDetails = document.getElementById("qrDetails");
    const qrStatus = document.getElementById("qrStatus");

    const logoutBtn = document.getElementById("logoutBtn");


    // =========================
    // DRIVER NAME
    // =========================

    const firstName = user.full_name
        ? user.full_name.split(" ")[0]
        : "Driver";

    if (driverGreeting) {
        driverGreeting.textContent =
            `Good morning, ${firstName} 👋`;
    }

    if (profileInitial) {
        profileInitial.textContent =
            firstName.charAt(0).toUpperCase();
    }


    // =========================
    // LOAD ASSIGNED BUS
    // =========================

    async function loadAssignedBus() {

        try {

            const response = await fetch(
                `${API}/driver-assignments`
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                assignedBus.textContent = "Not Assigned";
                assignedRoute.textContent = "No route assigned";
                generateQrBtn.disabled = true;
                return;
            }

            // Find assignment of currently logged-in driver
            const assignment = result.assignments.find(
                item => Number(item.driver_id) === Number(user.id)
            );

            if (!assignment) {

                assignedBus.textContent = "Not Assigned";
                assignedRoute.textContent = "No route assigned";

                generateQrBtn.disabled = true;

                return;
            }

            // =========================
            // SHOW BUS
            // =========================

            assignedBus.textContent =
                assignment.bus_number;

            assignedRoute.textContent =
                assignment.route;

            // Enable QR
            generateQrBtn.disabled = false;

            // Save bus locally
            localStorage.setItem(
                "busOneDriverBus",
                JSON.stringify(assignment)
            );

        } catch (error) {

            console.error("Bus loading error:", error);

            assignedBus.textContent = "Server Error";
            assignedRoute.textContent = "Unable to load";

            generateQrBtn.disabled = true;
        }
    }


    // =========================
    // GENERATE ATTENDANCE QR
    // =========================

    async function generateAttendanceQR() {

        generateQrBtn.disabled = true;

        generateQrBtn.innerHTML =
            `<span class="spinner-border spinner-border-sm me-2"></span>
             Generating QR...`;

        try {

            const response = await fetch(
                `${API}/driver/attendance-qr`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        driver_id: user.id
                    })
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {

                alert(
                    result.message ||
                    "Unable to generate QR."
                );

                return;
            }

            const qr = result.qr;

            // Clear previous QR
            qrContainer.innerHTML = "";

            const qrCodeDiv =
                document.createElement("div");

            qrContainer.appendChild(qrCodeDiv);


            // =========================
            // QR CODE
            // =========================

            new QRCode(qrCodeDiv, {

                text: qr.token,

                width: 200,
                height: 200,

                colorDark: "#000000",
                colorLight: "#ffffff",

                correctLevel:
                    QRCode.CorrectLevel.H

            });


            // =========================
            // STATUS
            // =========================

            qrStatus.textContent = "ACTIVE";

            qrStatus.className =
                "badge text-bg-success";


            // =========================
            // DETAILS
            // =========================

            qrDetails.innerHTML = `

                <div class="alert alert-success mb-0">

                    <strong>
                        <i class="bi bi-check-circle-fill me-1"></i>
                        Attendance QR Active
                    </strong>

                    <br>

                    <small>
                        Bus: ${qr.bus_number}
                        <br>
                        Route: ${qr.route}
                        <br>
                        Date: ${qr.date}
                    </small>

                </div>

            `;


            // Save today's QR
            localStorage.setItem(
                "busOneTodayQR",
                JSON.stringify(qr)
            );

        } catch (error) {

            console.error("QR error:", error);

            alert(
                "Unable to connect to BusOne server."
            );

        } finally {

            generateQrBtn.disabled = false;

            generateQrBtn.innerHTML =
                `<i class="bi bi-qr-code"></i>
                 Generate Today's QR`;

        }
    }


    // =========================
    // GENERATE BUTTON
    // =========================

    if (generateQrBtn) {

        generateQrBtn.addEventListener(
            "click",
            generateAttendanceQR
        );

    }


    // =========================
    // LOGOUT
    // =========================

    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            function () {

                localStorage.removeItem("busOneUser");
                localStorage.removeItem("busOneDriverBus");
                localStorage.removeItem("busOneTodayQR");

                window.location.href = "index.html";

            }
        );

    }


    // =========================
    // INITIAL LOAD
    // =========================

    await loadAssignedBus();

});