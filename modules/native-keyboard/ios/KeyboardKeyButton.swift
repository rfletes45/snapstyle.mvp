import UIKit

/// A single key on the custom keyboard.
/// Uses UIControl for built-in touch tracking.
class KeyboardKeyButton: UIControl {

    let keySpec: KeySpec

    /// The background color when not pressed.
    var normalColor: UIColor = .white {
        didSet { updateVisualState() }
    }

    private let label = UILabel()
    private let shadowLayer = CALayer()

    init(spec: KeySpec) {
        self.keySpec = spec
        super.init(frame: .zero)
        setupView()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - Setup

    private func setupView() {
        clipsToBounds = false
        layer.masksToBounds = false

        // Key shadow (subtle, below the key — like real iOS keyboard)
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOffset = CGSize(width: 0, height: 1)
        layer.shadowOpacity = 0.25
        layer.shadowRadius = 0.5

        // Label
        label.textAlignment = .center
        label.isUserInteractionEnabled = false
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: leadingAnchor),
            label.trailingAnchor.constraint(equalTo: trailingAnchor),
            label.topAnchor.constraint(equalTo: topAnchor),
            label.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        configureLabelForSpec()
        updateVisualState()
    }

    private func configureLabelForSpec() {
        switch keySpec.action {
        case .character:
            label.font = .systemFont(ofSize: 22, weight: .regular)
            label.text = keySpec.label

        case .space:
            label.font = .systemFont(ofSize: 16, weight: .regular)
            label.text = "space"

        case .returnSend:
            label.font = .systemFont(ofSize: 16, weight: .semibold)
            label.text = keySpec.label

        case .shift:
            label.font = .systemFont(ofSize: 18, weight: .regular)
            label.text = keySpec.label

        case .backspace:
            label.font = .systemFont(ofSize: 20, weight: .regular)
            label.text = keySpec.label

        case .switchMode:
            label.font = .systemFont(ofSize: 15, weight: .regular)
            label.text = keySpec.label

        case .globe:
            label.font = .systemFont(ofSize: 18, weight: .regular)
            label.text = keySpec.label
        }
    }

    // MARK: - Visual State

    func updateVisualState() {
        backgroundColor = normalColor
    }

    // MARK: - Touch Feedback

    override var isHighlighted: Bool {
        didSet {
            if isHighlighted {
                backgroundColor = normalColor.adjusted(by: -0.1)
            } else {
                backgroundColor = normalColor
            }
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        layer.cornerRadius = 5
    }
}

// MARK: - UIColor Adjustment

extension UIColor {
    /// Returns a slightly darker or lighter version of the color.
    func adjusted(by amount: CGFloat) -> UIColor {
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        if getHue(&h, saturation: &s, brightness: &b, alpha: &a) {
            return UIColor(hue: h, saturation: s, brightness: max(0, min(1, b + amount)), alpha: a)
        }
        return self
    }
}
