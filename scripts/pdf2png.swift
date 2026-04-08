import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Usage: swift pdf2png.swift <pdf_path> <page_number> <output_png_path> [scale]
guard CommandLine.arguments.count >= 4 else {
    fputs("Usage: pdf2png <pdf_path> <page_number> <output_path> [scale]\n", stderr)
    exit(1)
}

let pdfPath = CommandLine.arguments[1]
let pageNum = Int(CommandLine.arguments[2]) ?? 1
let outputPath = CommandLine.arguments[3]
let scale = CommandLine.arguments.count > 4 ? CGFloat(Double(CommandLine.arguments[4]) ?? 2.0) : 2.0

guard let pdfURL = CFURLCreateWithFileSystemPath(nil, pdfPath as CFString, .cfurlposixPathStyle, false),
      let pdf = CGPDFDocument(pdfURL),
      let page = pdf.page(at: pageNum) else {
    fputs("Error: could not open PDF or page \(pageNum)\n", stderr)
    exit(1)
}

let mediaBox = page.getBoxRect(.mediaBox)
let width = Int(mediaBox.width * scale)
let height = Int(mediaBox.height * scale)

let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let context = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: width * 4,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
    fputs("Error: could not create bitmap context\n", stderr)
    exit(1)
}

// White background
context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: width, height: height))

// Scale and render
context.scaleBy(x: scale, y: scale)
context.drawPDFPage(page)

guard let image = context.makeImage() else {
    fputs("Error: could not render page\n", stderr)
    exit(1)
}

let outputURL = URL(fileURLWithPath: outputPath) as CFURL
guard let destination = CGImageDestinationCreateWithURL(outputURL, "public.png" as CFString, 1, nil) else {
    fputs("Error: could not create output file\n", stderr)
    exit(1)
}

CGImageDestinationAddImage(destination, image, nil)
CGImageDestinationFinalize(destination)

print("OK: \(width)x\(height)")
