<footer class="border-t border-gray-200 bg-white">
  <div class="mx-auto max-w-6xl px-4 py-10">
    <!-- Top grid -->
    <div class="grid grid-cols-2 gap-8 sm:grid-cols-4">
      <!-- Brand -->
      <div class="col-span-2 sm:col-span-1">
        <a href="/" class="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="h-5 w-5 text-brand-500"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
              clip-rule="evenodd"
            />
          </svg>
          <span class="font-bold text-gray-900">ScrubSafe</span>
        </a>
        <p class="mt-2 text-sm leading-relaxed text-gray-400">
          All file processing happens in your browser. Nothing leaves your device.
        </p>
      </div>

      <!-- Tool -->
      <div>
        <h3 class="text-sm font-semibold text-gray-900">Tool</h3>
        <ul class="mt-3 space-y-2">
          <li><a href="/inspect" class="text-sm text-gray-400 transition-colors hover:text-gray-600">Inspect</a></li>
          <li><a href="/verify" class="text-sm text-gray-400 transition-colors hover:text-gray-600">Verify</a></li>
        </ul>
      </div>

      <!-- Learn -->
      <div>
        <h3 class="text-sm font-semibold text-gray-900">Learn</h3>
        <ul class="mt-3 space-y-2">
          <li>
            <a href="/how-it-works" class="text-sm text-gray-400 transition-colors hover:text-gray-600">
              How It Works
            </a>
          </li>
        </ul>
      </div>

      <!-- Account -->
      <div>
        <h3 class="text-sm font-semibold text-gray-900">Account</h3>
        <ul class="mt-3 space-y-2">
          <li><a href="/settings" class="text-sm text-gray-400 transition-colors hover:text-gray-600">Settings</a></li>
          <li><a href="/dashboard" class="text-sm text-gray-400 transition-colors hover:text-gray-600">Dashboard</a></li>
          <li>
            <a href="/auth/login" class="text-sm text-gray-400 transition-colors hover:text-gray-600">
              Sign In
            </a>
          </li>
        </ul>
      </div>
    </div>

    <!-- Bottom bar -->
    <div
      class="mt-8 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-8
             sm:flex-row"
    >
      <p class="text-sm text-gray-400">
        &copy; {new Date().getFullYear()} ScrubSafe. Privacy by design.
      </p>
      <nav class="flex gap-6">
        <a href="/privacy" class="text-sm text-gray-400 transition-colors hover:text-gray-600">
          Privacy
        </a>
        <a href="/terms" class="text-sm text-gray-400 transition-colors hover:text-gray-600">
          Terms
        </a>
        <a
          href="https://github.com/REM723/scrubsafe"
          class="text-sm text-gray-400 transition-colors hover:text-gray-600"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </nav>
    </div>
  </div>
</footer>
