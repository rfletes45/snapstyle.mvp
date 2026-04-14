import ExpoModulesCore

public class NativeKeyboardModule: Module {
    /// Weak reference to the active composer so module-level functions can access it.
    static weak var activeComposer: NativeComposerView?

    public func definition() -> ModuleDefinition {
        Name("NativeKeyboard")

        // MARK: - Imperative Functions

        Function("focus") {
            DispatchQueue.main.async {
                Self.activeComposer?.textView.becomeFirstResponder()
            }
        }

        Function("blur") {
            DispatchQueue.main.async {
                Self.activeComposer?.textView.resignFirstResponder()
            }
        }

        Function("clear") {
            DispatchQueue.main.async {
                Self.activeComposer?.clearText()
            }
        }

        Function("insertTextAtCursor") { (text: String) in
            DispatchQueue.main.async {
                Self.activeComposer?.textView.insertText(text)
            }
        }

        Function("setCursorPosition") { (position: Int) in
            DispatchQueue.main.async {
                guard let composer = Self.activeComposer else { return }
                let length = (composer.textView.text as NSString?)?.length ?? 0
                let clamped = min(max(position, 0), length)
                composer.textView.selectedRange = NSRange(location: clamped, length: 0)
            }
        }

        // MARK: - Native View

        View(NativeComposerView.self) {
            Events(
                "onTextChange",
                "onSelectionChange",
                "onSendPress",
                "onContentSizeChange",
                "onFocusChange"
            )

            Prop("text") { (view: NativeComposerView, text: String?) in
                view.setTextFromProp(text ?? "")
            }

            Prop("placeholder") { (view: NativeComposerView, placeholder: String?) in
                view.setPlaceholder(placeholder ?? "")
            }

            Prop("placeholderColor") { (view: NativeComposerView, color: String?) in
                view.setPlaceholderColor(UIColor.fromHex(color) ?? .placeholderText)
            }

            Prop("textColor") { (view: NativeComposerView, color: String?) in
                view.setTextColor(UIColor.fromHex(color) ?? .label)
            }

            Prop("selectionColor") { (view: NativeComposerView, color: String?) in
                view.tintColor = UIColor.fromHex(color) ?? .systemBlue
            }

            Prop("fontSize") { (view: NativeComposerView, size: Double?) in
                view.setFontSize(CGFloat(size ?? 16))
            }

            Prop("editable") { (view: NativeComposerView, editable: Bool?) in
                view.textView.isEditable = editable ?? true
            }

            Prop("maxLength") { (view: NativeComposerView, maxLength: Int?) in
                view.maxLength = maxLength ?? 0
            }

            Prop("keyboardAppearance") { (view: NativeComposerView, appearance: String?) in
                view.setKeyboardAppearance(appearance ?? "default")
            }
        }
    }
}

// MARK: - UIColor hex parsing

extension UIColor {
    static func fromHex(_ hex: String?) -> UIColor? {
        guard let hex = hex, !hex.isEmpty else { return nil }
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

        let length = hexSanitized.count
        switch length {
        case 6:
            return UIColor(
                red: CGFloat((rgb >> 16) & 0xFF) / 255.0,
                green: CGFloat((rgb >> 8) & 0xFF) / 255.0,
                blue: CGFloat(rgb & 0xFF) / 255.0,
                alpha: 1.0
            )
        case 8:
            return UIColor(
                red: CGFloat((rgb >> 24) & 0xFF) / 255.0,
                green: CGFloat((rgb >> 16) & 0xFF) / 255.0,
                blue: CGFloat((rgb >> 8) & 0xFF) / 255.0,
                alpha: CGFloat(rgb & 0xFF) / 255.0
            )
        default:
            return nil
        }
    }
}
