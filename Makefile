# MT Macro — build/debug shortcuts. Run `make help`.
APP          := app
export JAVA_HOME    := $(HOME)/.local/share/mise/installs/java/temurin-21.0.12+101.0.LTS
export ANDROID_HOME := $(HOME)/Android/Sdk
APK_DEBUG    := $(APP)/android/app/build/outputs/apk/debug/app-debug.apk
VERSION      := $(shell grep -oP 'versionName "\K[^"]+' $(APP)/android/app/build.gradle)
APK_OUT      := $(APP)/mt-macro-$(VERSION).apk
ADB          := $(ANDROID_HOME)/platform-tools/adb

.PHONY: help install dev build lint check preview sync apk install-apk run logcat devices clean

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

install: ## npm install
	cd $(APP) && npm install

dev: ## Dev server on LAN
	cd $(APP) && npm run dev -- --host

build: ## Type-check + production build → app/dist
	cd $(APP) && npm run build

lint: ## oxlint
	cd $(APP) && npm run lint

check: build lint ## Build + lint (definition of done)

preview: build ## Serve production build on LAN
	cd $(APP) && npm run preview -- --host

sync: build ## Copy dist/ into the Android project
	cd $(APP) && npx cap sync android

apk: sync ## Build debug APK → app/mt-macro-<version>.apk
	cd $(APP)/android && ./gradlew assembleDebug
	cp $(APK_DEBUG) $(APK_OUT)
	@echo "APK: $(abspath $(APK_OUT))"

install-apk: apk ## Build + install on USB-connected phone
	$(ADB) install -r $(APK_OUT)

run: install-apk ## Build, install and launch on phone
	$(ADB) shell monkey -p com.mtmad.mtmacro -c android.intent.category.LAUNCHER 1

logcat: ## Phone WebView/console logs (inspect UI: chrome://inspect)
	$(ADB) logcat -s Capacitor:* Capacitor/Console:* chromium:*

devices: ## List connected phones
	$(ADB) devices

clean: ## Remove build outputs
	rm -rf $(APP)/dist $(APP)/android/app/build $(APP)/mt-macro-*.apk
