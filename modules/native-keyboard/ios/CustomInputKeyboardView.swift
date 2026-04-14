import UIKit

// MARK: - Theme Config

struct KeyboardThemeConfig {
    var backgroundColor: UIColor = UIColor(red: 0.82, green: 0.84, blue: 0.86, alpha: 1.0)
    var keyColor: UIColor = .white
    var keyTextColor: UIColor = .black
    var specialKeyColor: UIColor = UIColor(red: 0.68, green: 0.70, blue: 0.73, alpha: 1.0)
    var specialKeyTextColor: UIColor = .black
    var returnKeyColor: UIColor = UIColor(red: 0.0, green: 0.48, blue: 1.0, alpha: 1.0)
    var returnKeyTextColor: UIColor = .white
}

// MARK: - Delegate

protocol CustomKeyboardActionDelegate: AnyObject {
    func keyboardDidInsertText(_ text: String)
    func keyboardDidDeleteBackward()
    func keyboardDidPressSend()
    func keyboardDidPressGlobe()
}

// MARK: - Keyboard State

enum KeyboardShiftState {
    case off
    case shifted
    case capsLocked
}

enum KeyboardMode {
    case letters
    case numbers
    case symbols
}

// MARK: - Key Spec

enum KeyAction {
    case character(String)
    case backspace
    case shift
    case switchMode(KeyboardMode)
    case space
    case returnSend
    case globe
}

struct KeySpec {
    let label: String
    let action: KeyAction
    let widthWeight: CGFloat
    /// If true, this key uses the special-key style (darker background)
    let isSpecial: Bool
    /// If true, this key uses the return/send style (primary color)
    let isReturn: Bool

    init(label: String, action: KeyAction, weight: CGFloat = 1.0, special: Bool = false, isReturn: Bool = false) {
        self.label = label
        self.action = action
        self.widthWeight = weight
        self.isSpecial = special
        self.isReturn = isReturn
    }
}

// MARK: - Main View

class CustomInputKeyboardView: UIView {

    // MARK: - Layout Constants

    private static let portraitKeyHeight: CGFloat = 42
    private static let landscapeKeyHeight: CGFloat = 36
    private static let iPadKeyHeight: CGFloat = 48
    private static let keyGapH: CGFloat = 6
    private static let keyGapV: CGFloat = 12
    private static let landscapeKeyGapV: CGFloat = 8
    private static let edgePadding: CGFloat = 3
    private static let topPadding: CGFloat = 6
    private static let keyCornerRadius: CGFloat = 5

    private var currentKeyHeight: CGFloat {
        if isIPad {
            return Self.iPadKeyHeight
        }
        return isLandscape ? Self.landscapeKeyHeight : Self.portraitKeyHeight
    }

    private var currentKeyGapV: CGFloat {
        return isLandscape ? Self.landscapeKeyGapV : Self.keyGapV
    }

    private var keysAreaHeight: CGFloat {
        let numRows = CGFloat(keyButtons.count > 0 ? keyButtons.count : 4)
        return Self.topPadding + numRows * currentKeyHeight + (numRows - 1) * currentKeyGapV + 6
    }

    private var isLandscape: Bool {
        guard let windowScene = window?.windowScene else {
            return bounds.width > bounds.height
        }
        return windowScene.interfaceOrientation.isLandscape
    }

    private var isIPad: Bool {
        return UIDevice.current.userInterfaceIdiom == .pad
    }

    // MARK: - Properties

    weak var actionDelegate: CustomKeyboardActionDelegate?

    private var theme = KeyboardThemeConfig()
    private var shiftState: KeyboardShiftState = .off
    private var mode: KeyboardMode = .letters
    private var keyButtons: [[KeyboardKeyButton]] = []
    private var bottomSafeArea: CGFloat = 0
    private let backgroundBackingView = UIView()
    private let safeAreaFillView = UIView()
    private let haptic = UIImpactFeedbackGenerator(style: .light)

    // Backspace repeat
    private var backspaceTimer: Timer?
    private var backspaceRepeatCount = 0

    // Shift double-tap detection
    private var lastShiftTapTime: TimeInterval = 0

    // Key pop-up preview
    private let keyPopup = KeyPopupView()

    // MARK: - Init

    override init(frame: CGRect) {
        super.init(frame: frame)
        isOpaque = true
        backgroundColor = theme.backgroundColor
        autoresizingMask = [.flexibleWidth, .flexibleHeight]
        backgroundBackingView.isOpaque = true
        backgroundBackingView.isUserInteractionEnabled = false
        backgroundBackingView.backgroundColor = theme.backgroundColor
        backgroundBackingView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        insertSubview(backgroundBackingView, at: 0)
        safeAreaFillView.isOpaque = true
        safeAreaFillView.isUserInteractionEnabled = false
        safeAreaFillView.backgroundColor = theme.backgroundColor
        insertSubview(safeAreaFillView, aboveSubview: backgroundBackingView)
        haptic.prepare()
        rebuildKeys()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - Intrinsic Size

    override var intrinsicContentSize: CGSize {
        return CGSize(width: UIView.noIntrinsicMetric, height: keysAreaHeight + bottomSafeArea)
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if let w = window {
            bottomSafeArea = w.safeAreaInsets.bottom
        } else {
            bottomSafeArea = 34 // default for notched devices
        }
        invalidateIntrinsicContentSize()
    }

    override func safeAreaInsetsDidChange() {
        super.safeAreaInsetsDidChange()
        bottomSafeArea = safeAreaInsets.bottom
        invalidateIntrinsicContentSize()
        setNeedsLayout()
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        invalidateIntrinsicContentSize()
        setNeedsLayout()
    }

    // MARK: - Theme

    func applyTheme(_ config: KeyboardThemeConfig) {
        theme = config
        backgroundColor = theme.backgroundColor
        backgroundBackingView.backgroundColor = theme.backgroundColor
        safeAreaFillView.backgroundColor = theme.backgroundColor
        applyThemeToButtons()
    }

    private func applyThemeToButtons() {
        for row in keyButtons {
            for button in row {
                if button.keySpec.isReturn {
                    button.normalColor = theme.returnKeyColor
                    button.setTitleColor(theme.returnKeyTextColor, for: .normal)
                } else if button.keySpec.isSpecial {
                    button.normalColor = theme.specialKeyColor
                    button.setTitleColor(theme.specialKeyTextColor, for: .normal)
                } else {
                    button.normalColor = theme.keyColor
                    button.setTitleColor(theme.keyTextColor, for: .normal)
                }
                button.updateVisualState()
            }
        }
    }

    // MARK: - Key Layout Data

    private func currentLayout() -> [[KeySpec]] {
        switch mode {
        case .letters:
            return shiftState == .off ? Self.lowercaseLayout : Self.uppercaseLayout
        case .numbers:
            return Self.numbersLayout
        case .symbols:
            return Self.symbolsLayout
        }
    }

    // MARK: - Build Keys

    private func rebuildKeys() {
        // Remove old buttons
        for row in keyButtons {
            for b in row { b.removeFromSuperview() }
        }
        keyButtons.removeAll()

        let layout = currentLayout()
        for row in layout {
            var buttons: [KeyboardKeyButton] = []
            for spec in row {
                let btn = KeyboardKeyButton(spec: spec)
                configureButton(btn)
                addSubview(btn)
                buttons.append(btn)
            }
            keyButtons.append(buttons)
        }
        applyThemeToButtons()
        setNeedsLayout()
    }

    private func configureButton(_ btn: KeyboardKeyButton) {
        btn.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
        btn.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
    }

    // MARK: - Layout

    override func layoutSubviews() {
        super.layoutSubviews()

        let w = bounds.width
        let contentHeight = keysAreaHeight

        backgroundBackingView.frame = bounds

        // Safe area fill
        safeAreaFillView.frame = CGRect(x: 0, y: contentHeight, width: w, height: bottomSafeArea)

        // Layout each row of keys
        let numRows = keyButtons.count
        guard numRows > 0 else { return }

        let rowHeight = currentKeyHeight
        let rowGap = currentKeyGapV

        for (rowIndex, row) in keyButtons.enumerated() {
            let y = Self.topPadding + CGFloat(rowIndex) * (rowHeight + rowGap)
            layoutRow(row, y: y, containerWidth: w, keyHeight: rowHeight)
        }
    }

    private func layoutRow(_ buttons: [KeyboardKeyButton], y: CGFloat, containerWidth: CGFloat, keyHeight: CGFloat) {
        let count = buttons.count
        guard count > 0 else { return }

        let totalGaps = Self.keyGapH * CGFloat(count - 1)
        let availableWidth = containerWidth - 2 * Self.edgePadding - totalGaps

        let totalWeight = buttons.reduce(CGFloat(0)) { $0 + $1.keySpec.widthWeight }
        let unitWidth = availableWidth / totalWeight

        var x = Self.edgePadding
        for button in buttons {
            let keyW = unitWidth * button.keySpec.widthWeight
            button.frame = CGRect(x: x, y: y, width: keyW, height: keyHeight)
            button.layer.cornerRadius = Self.keyCornerRadius
            x += keyW + Self.keyGapH
        }
    }

    // MARK: - Touch Handling

    @objc private func keyTouchDown(_ sender: KeyboardKeyButton) {
        haptic.impactOccurred()

        switch sender.keySpec.action {
        case .character(let ch):
            // Show pop-up preview for character keys
            let displayChar: String
            switch shiftState {
            case .off:
                displayChar = ch.lowercased()
            case .shifted, .capsLocked:
                displayChar = ch.uppercased()
            }
            keyPopup.show(for: sender, character: displayChar, keyColor: theme.keyColor, textColor: theme.keyTextColor, in: self)
        case .backspace:
            actionDelegate?.keyboardDidDeleteBackward()
            startBackspaceRepeat()
        default:
            break
        }
    }

    @objc private func keyTouchUp(_ sender: KeyboardKeyButton) {
        stopBackspaceRepeat()
        keyPopup.hide()

        switch sender.keySpec.action {
        case .character(let ch):
            let text: String
            switch shiftState {
            case .off:
                text = ch.lowercased()
            case .shifted:
                text = ch.uppercased()
                // Auto-return to lowercase after one character
                shiftState = .off
                rebuildKeys()
            case .capsLocked:
                text = ch.uppercased()
            }
            actionDelegate?.keyboardDidInsertText(text)

        case .space:
            actionDelegate?.keyboardDidInsertText(" ")

        case .backspace:
            // Already handled in touchDown
            break

        case .shift:
            handleShiftTap()

        case .switchMode(let newMode):
            mode = newMode
            rebuildKeys()

        case .returnSend:
            actionDelegate?.keyboardDidPressSend()

        case .globe:
            actionDelegate?.keyboardDidPressGlobe()
        }
    }

    // MARK: - Shift Logic

    private func handleShiftTap() {
        let now = ProcessInfo.processInfo.systemUptime
        let elapsed = now - lastShiftTapTime
        lastShiftTapTime = now

        switch shiftState {
        case .off:
            if elapsed < 0.3 {
                shiftState = .capsLocked
            } else {
                shiftState = .shifted
            }
        case .shifted:
            if elapsed < 0.3 {
                shiftState = .capsLocked
            } else {
                shiftState = .off
            }
        case .capsLocked:
            shiftState = .off
        }
        rebuildKeys()
    }

    // MARK: - Backspace Repeat

    private func startBackspaceRepeat() {
        backspaceRepeatCount = 0
        // Initial delay before repeat starts (matches iOS system keyboard behavior)
        backspaceTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: false) { [weak self] _ in
            self?.startAcceleratingBackspace()
        }
    }

    private func startAcceleratingBackspace() {
        // Phase 1: character-by-character at 0.1s (chars 1-6)
        // Phase 2: faster chars at 0.05s (chars 7-15)
        // Phase 3: word-by-word deletion (chars 16+)
        backspaceTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] timer in
            guard let self = self else { timer.invalidate(); return }
            self.backspaceRepeatCount += 1

            if self.backspaceRepeatCount > 15 {
                // Word-at-a-time deletion
                self.deleteWordBackward()
            } else {
                self.actionDelegate?.keyboardDidDeleteBackward()
            }

            // Speed up interval after initial phase
            if self.backspaceRepeatCount == 6 {
                timer.invalidate()
                self.backspaceTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] innerTimer in
                    guard let self = self else { innerTimer.invalidate(); return }
                    self.backspaceRepeatCount += 1
                    if self.backspaceRepeatCount > 15 {
                        innerTimer.invalidate()
                        // Switch to word deletion mode
                        self.backspaceTimer = Timer.scheduledTimer(withTimeInterval: 0.12, repeats: true) { [weak self] wordTimer in
                            guard let self = self else { wordTimer.invalidate(); return }
                            self.deleteWordBackward()
                        }
                    } else {
                        self.actionDelegate?.keyboardDidDeleteBackward()
                    }
                }
            }
        }
    }

    private func deleteWordBackward() {
        // Delegate to the composer's text view to delete a word
        actionDelegate?.keyboardDidDeleteBackward()
        // Fire several rapid deletes to simulate word deletion
        // We send 4 extra deletes rapidly to chunk through words
        for _ in 0..<4 {
            actionDelegate?.keyboardDidDeleteBackward()
        }
    }

    private func stopBackspaceRepeat() {
        backspaceTimer?.invalidate()
        backspaceTimer = nil
        backspaceRepeatCount = 0
    }

    // MARK: - Static Layouts

    // Row 0 has 10 keys, row 1 has 9 keys (with side padding via weight),
    // row 2 has shift + 7 letters + backspace, row 3 has specials + space + return

    static let lowercaseLayout: [[KeySpec]] = [
        // Row 0
        ["q","w","e","r","t","y","u","i","o","p"].map { KeySpec(label: $0, action: .character($0)) },
        // Row 1 — slightly wider keys to center
        ["a","s","d","f","g","h","j","k","l"].map { KeySpec(label: $0, action: .character($0), weight: 1.1) },
        // Row 2
        [
            KeySpec(label: "⇧", action: .shift, weight: 1.5, special: true),
        ] + ["z","x","c","v","b","n","m"].map { KeySpec(label: $0, action: .character($0)) }
        + [
            KeySpec(label: "⌫", action: .backspace, weight: 1.5, special: true),
        ],
        // Row 3
        [
            KeySpec(label: "123", action: .switchMode(.numbers), weight: 1.5, special: true),
            KeySpec(label: "🌐", action: .globe, weight: 1.0, special: true),
            KeySpec(label: " ", action: .space, weight: 5.0),
            KeySpec(label: "Send", action: .returnSend, weight: 2.3, isReturn: true),
        ],
    ]

    static let uppercaseLayout: [[KeySpec]] = [
        ["Q","W","E","R","T","Y","U","I","O","P"].map { KeySpec(label: $0, action: .character($0)) },
        ["A","S","D","F","G","H","J","K","L"].map { KeySpec(label: $0, action: .character($0), weight: 1.1) },
        [
            KeySpec(label: "⇧", action: .shift, weight: 1.5, special: true),
        ] + ["Z","X","C","V","B","N","M"].map { KeySpec(label: $0, action: .character($0)) }
        + [
            KeySpec(label: "⌫", action: .backspace, weight: 1.5, special: true),
        ],
        [
            KeySpec(label: "123", action: .switchMode(.numbers), weight: 1.5, special: true),
            KeySpec(label: "🌐", action: .globe, weight: 1.0, special: true),
            KeySpec(label: " ", action: .space, weight: 5.0),
            KeySpec(label: "Send", action: .returnSend, weight: 2.3, isReturn: true),
        ],
    ]

    static let numbersLayout: [[KeySpec]] = [
        ["1","2","3","4","5","6","7","8","9","0"].map { KeySpec(label: $0, action: .character($0)) },
        ["-","/",":",";","(",")","$","&","@","\""].map { KeySpec(label: $0, action: .character($0)) },
        [
            KeySpec(label: "#+=", action: .switchMode(.symbols), weight: 1.5, special: true),
        ] + [".",",","?","!","'"].map { KeySpec(label: $0, action: .character($0), weight: 1.15) }
        + [
            KeySpec(label: "⌫", action: .backspace, weight: 1.5, special: true),
        ],
        [
            KeySpec(label: "ABC", action: .switchMode(.letters), weight: 1.5, special: true),
            KeySpec(label: "🌐", action: .globe, weight: 1.0, special: true),
            KeySpec(label: " ", action: .space, weight: 5.0),
            KeySpec(label: "Send", action: .returnSend, weight: 2.3, isReturn: true),
        ],
    ]

    static let symbolsLayout: [[KeySpec]] = [
        ["[","]","{","}","#","%","^","*","+","="].map { KeySpec(label: $0, action: .character($0)) },
        ["_","\\","|","~","<",">","€","£","¥","•"].map { KeySpec(label: $0, action: .character($0)) },
        [
            KeySpec(label: "123", action: .switchMode(.numbers), weight: 1.5, special: true),
        ] + [".",",","?","!","'"].map { KeySpec(label: $0, action: .character($0), weight: 1.15) }
        + [
            KeySpec(label: "⌫", action: .backspace, weight: 1.5, special: true),
        ],
        [
            KeySpec(label: "ABC", action: .switchMode(.letters), weight: 1.5, special: true),
            KeySpec(label: "🌐", action: .globe, weight: 1.0, special: true),
            KeySpec(label: " ", action: .space, weight: 5.0),
            KeySpec(label: "Send", action: .returnSend, weight: 2.3, isReturn: true),
        ],
    ]
}
