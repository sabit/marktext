// Utility class for standardized progress reporting
class ProgressManager {
  constructor (totalSteps = 100) {
    this.totalSteps = totalSteps
    this.currentStep = 0
    this.sections = []
  }

  addSection (name, weight) {
    this.sections.push({ name, weight })
    return this.sections.length - 1
  }

  calculateSectionProgress (sectionIndex, progress) {
    // Calculate overall progress based on section weights
    let totalWeight = this.sections.reduce((sum, s) => sum + s.weight, 0)
    let progressSum = 0
    for (let i = 0; i < this.sections.length; i++) {
      if (i < sectionIndex) {
        progressSum += this.sections[i].weight
      } else if (i === sectionIndex) {
        progressSum += this.sections[i].weight * (progress / 100)
      }
    }
    return Math.round((progressSum / totalWeight) * 100)
  }

  updateSection (sectionIndex, progress, message, bus) {
    const sectionProgress = this.calculateSectionProgress(sectionIndex, progress)
    if (bus) {
      bus.$emit('merge-progress', {
        progress: sectionProgress,
        message: message || this.sections[sectionIndex].name
      })
    }
  }
}

module.exports = ProgressManager
