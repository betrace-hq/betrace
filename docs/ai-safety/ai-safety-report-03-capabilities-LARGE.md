# Section 1: Capabilities of General-Purpose AI

**Note**: This section is 1,293 lines from the original report. The full extracted text is available at `/tmp/section-capabilities.txt`. Due to size, this file contains structural outline and key findings. Request specific subsections for detailed analysis.

## Structure

### 1.1 How general-purpose AI is developed (lines 1050-1374)
- Deep learning fundamentals
- Development lifecycle stages:
  - Data collection and pre-processing
  - Pre-training (most compute-intensive)
  - Fine-tuning (most labor-intensive)
  - System integration
  - Deployment
  - Post-deployment monitoring

**Key update since Interim Report**: Reasoning abilities improved via chain-of-thought techniques (e.g., OpenAI o1)

### 1.2 Current capabilities (lines 1375-1754)
**What AI CAN do:**
- Assist programming, small-to-medium software tasks
- Generate photorealistic images
- Fluent conversation in many languages
- Multi-modal processing (text, video, speech)
- Graduate-level textbook problems

**What AI CANNOT do:**
- Useful robotic household tasks
- Consistently avoid false statements
- Execute long independent projects

**Key update**: Marked improvement in scientific reasoning and programming tests via chain-of-thought methods

### 1.3 Capabilities in coming years (lines 1755-2342)
- Future progress could range from slow to extremely rapid
- Depends on continued "scaling" effectiveness
- **Inference scaling**: New approach using more compute at runtime
- Projections: 100x more compute by 2026, 10,000x by 2030 (if trends continue)
- Major bottlenecks: data availability, AI chips, capital, energy

**Policymaker challenge**: "Evidence dilemma" - must act without complete scientific evidence

---

## To extract full text for specific analysis:
```bash
# Full Capabilities section
sed -n '1050,2342p' "/Users/sscoble/Projects/betrace/1 International Scientific Report on the" 

# Or subsections:
sed -n '1050,1374p' ...  # 1.1 How AI is developed
sed -n '1375,1754p' ...  # 1.2 Current capabilities  
sed -n '1755,2342p' ...  # 1.3 Future capabilities
```
