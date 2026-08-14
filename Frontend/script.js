document.addEventListener('DOMContentLoaded', () => {
  const API = `${window.location.protocol}//${window.location.hostname}:5000`;
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const togglePasswordButton = document.getElementById('togglePassword');
  const eyeIcon = document.getElementById('eyeIcon');
  const forgotPasswordLink = document.getElementById('forgotPassword');
  const usernameError = document.getElementById('usernameError');
  const passwordError = document.getElementById('passwordError');
  const rememberMe = document.getElementById('remember');
  const roleCards = [...document.querySelectorAll('.role-card')];
  const roleInputs = [...document.querySelectorAll('input[name="role"]')];

  const getSelectedRole = () => document.querySelector('input[name="role"]:checked')?.value || 'admin';

  const updateRoleSelection = () => {
    const selectedRole = getSelectedRole();

    roleCards.forEach((card) => {
      const input = card.querySelector('input[type="radio"]');
      card.classList.toggle('active', Boolean(input && input.value === selectedRole));
    });
  };

  roleInputs.forEach((input) => {
    input.addEventListener('change', updateRoleSelection);
  });

  roleCards.forEach((card) => {
    card.addEventListener('click', () => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        updateRoleSelection();
      }
    });
  });

  togglePasswordButton.addEventListener('click', () => {
    const isPasswordHidden = passwordInput.type === 'password';
    passwordInput.type = isPasswordHidden ? 'text' : 'password';
    eyeIcon.classList.toggle('bi-eye', !isPasswordHidden);
    eyeIcon.classList.toggle('bi-eye-slash', isPasswordHidden);
  });

  forgotPasswordLink.addEventListener('click', (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim() || 'your account';
    alert(`A password reset link has been sent to ${username}.`);
  });

  const setError = (element, message) => {
    element.textContent = message;
  };

  const clearErrors = () => {
    setError(usernameError, '');
    setError(passwordError, '');
  };

  const validDemoAccounts = {
    admin: {
      usernames: ['admin', 'admin@busone.com'],
      password: 'admin123'
    },
    driver: {
      usernames: ['driver', 'driver@busone.com'],
      password: 'driver123'
    },
    passenger: {
      usernames: ['passenger', 'passenger@busone.com'],
      password: 'passenger123'
    }
  };

  const rememberedUser = localStorage.getItem('busOneRememberedUser');
  if (rememberedUser) {
    usernameInput.value = rememberedUser;
    rememberMe.checked = true;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearErrors();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const selectedRole = getSelectedRole();

    if (!username) {
      setError(usernameError, "Username or email is required.");
      return;
    }

    if (!password) {
      setError(passwordError, "Password is required.");
      return;
    }

    try {
      const response = await fetch(`${API}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: username,
          password: password,
          role: selectedRole
        })
      });

      const result = await response.json();

      if (result.success) {
        alert("Login successful! Welcome " + result.user.full_name);

        // Save logged-in user information
        localStorage.setItem("busOneUser", JSON.stringify(result.user));

        loginForm.reset();
        updateRoleSelection();

        // Role-based dashboard
        const userRole = result.user.role || selectedRole;

        if (userRole === "admin") {
          window.location.href = "admin-dashboard.html";
        }
        else if (userRole === "driver") {
          window.location.href = "driver-dashboard.html";
        }
        else if (userRole === "passenger") {
          window.location.href = "passenger-dashboard.html";
        }
        else {
          alert("Invalid user role.");
        }
      } else {
        alert(result.message);
      }

    } catch (error) {
      console.error(error);
      alert("Unable to connect to BusOne server.");
    }
  });

  // =========================
  // SIGNUP
  // =========================

  const signupForm = document.getElementById("signupForm");

  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const fullName = document.getElementById("signupName").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const role = document.getElementById("signupRole").value;
      const password = document.getElementById("signupPassword").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      if (!fullName || !email || !role || !password || !confirmPassword) {
        alert("Please fill all fields.");
        return;
      }

      if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
      }

      try {
        const response = await fetch(`${API}/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            full_name: fullName,
            email: email,
            role: role,
            password: password
          })
        });

        const result = await response.json();

        if (result.success) {
          alert("Account created successfully!");

          signupForm.reset();

          // Close Bootstrap modal
          const modalElement = document.getElementById("signupModal");

          if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
              modal.hide();
            }
          }
        } else {
          alert(result.message);
        }

      } catch (error) {
        console.error(error);
        alert("Unable to connect to BusOne server.");
      }
    });
  }
  updateRoleSelection();
});
console.log("BusOne JavaScript is working!");