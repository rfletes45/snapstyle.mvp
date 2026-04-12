import UIKit

/// Magnified character pop-up that appears above a key when pressed,
/// mimicking the native iOS keyboard key preview bubble.
class KeyPopupView: UIView {

    private let charLabel = UILabel()
    private static let popupWidth: CGFloat = 56
    private static let popupHeight: CGFloat = 56
    private static let stemHeight: CGFloat = 8
    private static let cornerRadius: CGFloat = 9

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        backgroundColor = .clear

        charLabel.textAlignment = .center
        charLabel.font = .systemFont(ofSize: 28, weight: .regular)
        charLabel.textColor = .black
        charLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(charLabel)
        NSLayoutConstraint.activate([
            charLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            charLabel.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            charLabel.widthAnchor.constraint(equalTo: widthAnchor),
            charLabel.heightAnchor.constraint(equalToConstant: Self.popupHeight - Self.stemHeight - 4),
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - Show / Hide

    /// Show the pop-up above the given key button in the specified container.
    func show(for key: KeyboardKeyButton, character: String, keyColor: UIColor, textColor: UIColor, in container: UIView) {
        charLabel.text = character
        charLabel.textColor = textColor
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOffset = CGSize(width: 0, height: 2)
        layer.shadowOpacity = 0.2
        layer.shadowRadius = 4

        // Convert key frame to container coordinate space
        let keyFrame = key.convert(key.bounds, to: container)

        let totalHeight = Self.popupHeight + Self.stemHeight
        let centerX = keyFrame.midX
        let popupX = centerX - Self.popupWidth / 2
        let popupY = keyFrame.minY - totalHeight

        frame = CGRect(x: popupX, y: popupY, width: Self.popupWidth, height: totalHeight)

        // Clamp horizontal position to stay within container
        if frame.minX < 4 {
            frame.origin.x = 4
        }
        if frame.maxX > container.bounds.width - 4 {
            frame.origin.x = container.bounds.width - 4 - Self.popupWidth
        }

        popupColor = keyColor
        setNeedsDisplay()

        if superview == nil {
            container.addSubview(self)
        }
        isHidden = false
    }

    func hide() {
        isHidden = true
        removeFromSuperview()
    }

    // MARK: - Drawing

    private var popupColor: UIColor = .white

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }

        let bubbleRect = CGRect(x: 0, y: 0, width: bounds.width, height: Self.popupHeight)
        let path = UIBezierPath(roundedRect: bubbleRect, cornerRadius: Self.cornerRadius)

        // Stem (small triangle connecting bubble to key position)
        let stemCenterX = bounds.width / 2
        let stemTop = Self.popupHeight
        let stemBottom = Self.popupHeight + Self.stemHeight
        let stemHalfWidth: CGFloat = 10

        let stemPath = UIBezierPath()
        stemPath.move(to: CGPoint(x: stemCenterX - stemHalfWidth, y: stemTop))
        stemPath.addLine(to: CGPoint(x: stemCenterX, y: stemBottom))
        stemPath.addLine(to: CGPoint(x: stemCenterX + stemHalfWidth, y: stemTop))
        stemPath.close()

        path.append(stemPath)

        ctx.setFillColor(popupColor.cgColor)
        ctx.addPath(path.cgPath)
        ctx.fillPath()
    }
}
