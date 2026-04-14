import ExpoModulesCore
import UIKit

/// Native UITextView-backed composer view that uses Apple's system keyboard.
/// Replaces the React Native TextInput for the chat composer on iOS.
class NativeComposerView: ExpoView, UITextViewDelegate {

    // MARK: - Event Dispatchers

    let onTextChange = EventDispatcher()
    let onSelectionChange = EventDispatcher()
    let onSendPress = EventDispatcher()
    let onContentSizeChange = EventDispatcher()
    let onFocusChange = EventDispatcher()

    // MARK: - Subviews

    let textView = UITextView()
    private let placeholderLabel = UILabel()

    // MARK: - State

    var maxLength: Int = 0
    private var lastReportedText: String = ""
    private var lastContentHeight: CGFloat = 0
    private var isUpdatingFromProp = false

    // MARK: - Init

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        NativeKeyboardModule.activeComposer = self
        setupTextView()
        setupPlaceholder()
    }

    deinit {
        if NativeKeyboardModule.activeComposer === self {
            NativeKeyboardModule.activeComposer = nil
        }
    }

    // MARK: - Setup

    private func setupTextView() {
        textView.delegate = self
        textView.font = .systemFont(ofSize: 16)
        textView.backgroundColor = .clear
        textView.textContainerInset = UIEdgeInsets(top: 8, left: 4, bottom: 8, right: 4)
        textView.textContainer.lineFragmentPadding = 0
        textView.isScrollEnabled = true
        textView.showsVerticalScrollIndicator = false
        textView.autocorrectionType = .yes
        textView.spellCheckingType = .yes
        textView.smartDashesType = .default
        textView.smartQuotesType = .default
        textView.smartInsertDeleteType = .default
        textView.returnKeyType = .send
        // No custom inputView — use Apple's default system keyboard
        textView.inputAccessoryView = nil
        // Remove default padding and let the view size itself
        textView.translatesAutoresizingMaskIntoConstraints = true
        addSubview(textView)
    }

    private func setupPlaceholder() {
        placeholderLabel.font = textView.font
        placeholderLabel.textColor = .placeholderText
        placeholderLabel.text = "Message..."
        placeholderLabel.numberOfLines = 1
        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        // Insert placeholder behind the text view's text layer
        textView.addSubview(placeholderLabel)
        NSLayoutConstraint.activate([
            placeholderLabel.leadingAnchor.constraint(equalTo: textView.leadingAnchor, constant: 4),
            placeholderLabel.topAnchor.constraint(equalTo: textView.topAnchor, constant: 8),
            placeholderLabel.trailingAnchor.constraint(lessThanOrEqualTo: textView.trailingAnchor, constant: -4),
        ])
    }

    // MARK: - Layout

    override var intrinsicContentSize: CGSize {
        let textHeight = textView.sizeThatFits(CGSize(
            width: bounds.width > 0 ? bounds.width : UIScreen.main.bounds.width,
            height: .greatestFiniteMagnitude
        )).height
        let minHeight: CGFloat = 36
        let maxHeight: CGFloat = 120
        let clamped = min(max(textHeight, minHeight), maxHeight)
        return CGSize(width: UIView.noIntrinsicMetric, height: clamped)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        textView.frame = bounds
        checkContentSizeChange()
    }

    // MARK: - Prop Setters

    func setTextFromProp(_ text: String) {
        guard textView.text != text else { return }
        isUpdatingFromProp = true
        textView.text = text
        // Place cursor at end of text when set from prop (for mention insertion / draft restore)
        let endPosition = (text as NSString).length
        textView.selectedRange = NSRange(location: endPosition, length: 0)
        isUpdatingFromProp = false
        updatePlaceholderVisibility()
        checkContentSizeChange()
    }

    func setPlaceholder(_ placeholder: String) {
        placeholderLabel.text = placeholder
    }

    func setPlaceholderColor(_ color: UIColor) {
        placeholderLabel.textColor = color
    }

    func setTextColor(_ color: UIColor) {
        textView.textColor = color
    }

    func setFontSize(_ size: CGFloat) {
        textView.font = .systemFont(ofSize: size)
        placeholderLabel.font = textView.font
    }

    func setKeyboardAppearance(_ appearance: String) {
        switch appearance {
        case "dark":
            textView.keyboardAppearance = .dark
        case "light":
            textView.keyboardAppearance = .light
        default:
            textView.keyboardAppearance = .default
        }
    }

    // MARK: - Imperative Actions

    func clearText() {
        textView.text = ""
        updatePlaceholderVisibility()
        checkContentSizeChange()
        emitTextChange()
    }

    // MARK: - UITextViewDelegate

    func textViewDidChange(_ textView: UITextView) {
        guard !isUpdatingFromProp else { return }
        updatePlaceholderVisibility()
        checkContentSizeChange()
        emitTextChange()
    }

    func textViewDidChangeSelection(_ textView: UITextView) {
        let range = textView.selectedRange
        onSelectionChange([
            "start": range.location,
            "end": range.location + range.length,
        ])
    }

    func textViewDidBeginEditing(_ textView: UITextView) {
        onFocusChange(["isFocused": true])
    }

    func textViewDidEndEditing(_ textView: UITextView) {
        onFocusChange(["isFocused": false])
    }

    func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
        // Return key type is .send — intercept "\n" to trigger send
        // instead of inserting a newline.
        if text == "\n" {
            handleSendPress()
            return false
        }
        // Enforce maxLength if set
        if maxLength > 0 {
            let currentText = textView.text ?? ""
            let newLength = currentText.count - range.length + text.count
            if newLength > maxLength {
                return false
            }
        }
        return true
    }

    // MARK: - Send

    private func handleSendPress() {
        let text = textView.text ?? ""
        onSendPress(["text": text])
    }

    // MARK: - Helpers

    private func updatePlaceholderVisibility() {
        placeholderLabel.isHidden = !textView.text.isEmpty
    }

    private func emitTextChange() {
        let text = textView.text ?? ""
        let cursor = textView.selectedRange.location
        lastReportedText = text
        onTextChange([
            "text": text,
            "cursorPosition": cursor,
        ])
    }

    private func checkContentSizeChange() {
        let contentSize = textView.contentSize
        if contentSize.height != lastContentHeight {
            lastContentHeight = contentSize.height
            invalidateIntrinsicContentSize()
            onContentSizeChange([
                "width": contentSize.width,
                "height": contentSize.height,
            ])
        }
    }
}
