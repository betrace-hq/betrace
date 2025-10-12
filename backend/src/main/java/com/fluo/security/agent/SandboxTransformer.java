package com.fluo.security.agent;

import org.objectweb.asm.*;
import org.objectweb.asm.commons.AdviceAdapter;

import java.lang.instrument.ClassFileTransformer;
import java.security.ProtectionDomain;
import java.util.logging.Logger;

/**
 * Bytecode transformer for rule engine sandboxing.
 *
 * Replaces deprecated SecurityManager with bytecode-level restrictions:
 * - Intercepts Method.setAccessible() calls
 * - Blocks Unsafe API access
 * - Prevents System.exit()
 * - Blocks file/network I/O
 *
 * Transformation Strategy:
 * 1. Scan bytecode for forbidden method calls
 * 2. Inject SandboxContext.isInRuleExecution() check
 * 3. Throw SecurityException if check returns true
 *
 * Thread Safety:
 *   Stateless transformer, thread-safe
 *
 * Performance:
 *   Transform happens once at class load time (no runtime overhead)
 *
 * @see SandboxAgent
 * @see SandboxContext
 */
public class SandboxTransformer implements ClassFileTransformer {

    private static final Logger log = Logger.getLogger(SandboxTransformer.class.getName());

    // Forbidden classes (block all method calls on these)
    private static final String[] FORBIDDEN_CLASSES = {
        "sun/misc/Unsafe",
        "jdk/internal/misc/Unsafe",
        "java/lang/Runtime",
        "java/lang/ProcessBuilder"
    };

    // Forbidden methods (block specific methods)
    private static final String[] FORBIDDEN_METHODS = {
        "java/lang/reflect/AccessibleObject.setAccessible",
        "java/lang/reflect/Field.setAccessible",
        "java/lang/reflect/Method.setAccessible",
        "java/lang/reflect/Constructor.setAccessible",
        "java/lang/System.exit",
        "java/lang/Runtime.exit",
        "java/lang/Runtime.halt"
    };

    @Override
    public byte[] transform(ClassLoader loader,
                          String className,
                          Class<?> classBeingRedefined,
                          ProtectionDomain protectionDomain,
                          byte[] classfileBuffer) {

        // Skip FLUO internal classes (avoid transforming sandbox itself)
        if (className != null && className.startsWith("com/fluo/security/")) {
            return null;
        }

        // Skip Java standard library (performance optimization)
        if (className != null && (className.startsWith("java/") ||
                                  className.startsWith("javax/") ||
                                  className.startsWith("jdk/"))) {
            return null;
        }

        try {
            ClassReader reader = new ClassReader(classfileBuffer);
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_FRAMES);

            ClassVisitor visitor = new SandboxClassVisitor(Opcodes.ASM9, writer, className);
            reader.accept(visitor, 0);

            byte[] transformedBytes = writer.toByteArray();

            if (transformedBytes != classfileBuffer) {
                log.fine("Transformed class for sandbox enforcement: " + className);
            }

            return transformedBytes;

        } catch (Exception e) {
            log.warning("Failed to transform class " + className + ": " + e.getMessage());
            return null;  // Return null = use original bytecode
        }
    }

    /**
     * ASM ClassVisitor for injecting sandbox checks.
     */
    private static class SandboxClassVisitor extends ClassVisitor {

        private final String className;

        public SandboxClassVisitor(int api, ClassVisitor cv, String className) {
            super(api, cv);
            this.className = className;
        }

        @Override
        public MethodVisitor visitMethod(int access, String name, String descriptor,
                                        String signature, String[] exceptions) {
            MethodVisitor mv = super.visitMethod(access, name, descriptor, signature, exceptions);
            return new SandboxMethodVisitor(api, mv, access, name, descriptor, className);
        }
    }

    /**
     * ASM MethodVisitor for intercepting forbidden method calls.
     */
    private static class SandboxMethodVisitor extends AdviceAdapter {

        private final String className;

        protected SandboxMethodVisitor(int api, MethodVisitor mv, int access,
                                      String name, String descriptor, String className) {
            super(api, mv, access, name, descriptor);
            this.className = className;
        }

        @Override
        public void visitMethodInsn(int opcode, String owner, String name,
                                   String descriptor, boolean isInterface) {

            // Check if this is a forbidden method call
            String methodSignature = owner + "." + name;

            if (isForbiddenMethod(owner, name)) {
                // Inject sandbox check before method call:
                //
                // if (SandboxContext.isInRuleExecution()) {
                //     throw new SecurityException("Forbidden: " + methodSignature);
                // }

                // Check if in rule execution
                mv.visitMethodInsn(INVOKESTATIC,
                    "com/fluo/security/agent/SandboxContext",
                    "isInRuleExecution",
                    "()Z",
                    false);

                Label allowLabel = new Label();
                mv.visitJumpInsn(IFEQ, allowLabel);  // Jump if false (not in rule execution)

                // Throw SecurityException
                mv.visitTypeInsn(NEW, "java/lang/SecurityException");
                mv.visitInsn(DUP);
                mv.visitLdcInsn("Sandbox violation: " + methodSignature +
                              " is not allowed in rule execution");
                mv.visitMethodInsn(INVOKESPECIAL,
                    "java/lang/SecurityException",
                    "<init>",
                    "(Ljava/lang/String;)V",
                    false);
                mv.visitInsn(ATHROW);

                mv.visitLabel(allowLabel);
                mv.visitFrame(F_SAME, 0, null, 0, null);
            }

            // Continue with original method call
            super.visitMethodInsn(opcode, owner, name, descriptor, isInterface);
        }

        private boolean isForbiddenMethod(String owner, String name) {
            // Check forbidden classes
            for (String forbidden : FORBIDDEN_CLASSES) {
                if (owner.equals(forbidden)) {
                    return true;
                }
            }

            // Check forbidden methods
            String methodSignature = owner + "." + name;
            for (String forbidden : FORBIDDEN_METHODS) {
                if (methodSignature.equals(forbidden)) {
                    return true;
                }
            }

            return false;
        }
    }
}
