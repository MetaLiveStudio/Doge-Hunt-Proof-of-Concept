We are developing a Decentraland-based mobile game titled **Doge Hunt**. Our core objective is to create a game optimized specifically for the Decentraland mobile client, rather than a generic web-based experience. The following development guidelines and skills are critical.

### **Core Rules**
1. **Task Logging Requirement**:
   - A `tasks.md` file must be maintained in the project root.
   - **Before starting any new task**, all AI agents and developers must read and understand the history and current plans in `tasks.md`.
   - **Immediately upon completing a task** (or a major sub-task phase), `tasks.md` must be updated with the task description, completion status, encountered issues, and next steps.
2. **Preview Mode Restriction**:
   - **Do not launch preview mode** without explicit authorization. Previewing and verification are handled manually by designated personnel.

### **Technical Specifications (SDK7/ECS7)**
1. **Development Framework**:
   - Must use Decentraland SDK7 (ECS7) and its standard components.
   - UI development should prioritize `@dcl/react-ecs` (the official SDK7 UI solution).
2. **Mobile Optimization**:
   - Strictly control the number of Entities and Triangles.
   - Texture sizes should ideally not exceed 512x512, using square and power-of-two dimensions where possible.
   - Avoid high-overhead calculations or frequent memory allocations within every frame (Systems).
3. **Architectural Patterns**:
   - Follow data-driven design patterns: logic in Systems, state in Components.
   - Keep code modular; extract common functionality into utility classes or independent Systems.

### **Reference Resources**
- [Decentraland - Building for Mobile Guide Book](https://confirmed-copper-f3a.notion.site/Decentraland-Building-for-Mobile-2f55f96e0b70805785abdaba16c5f763)
- [Decentraland Skills (OpenDCL)](https://github.com/dcl-regenesislabs/opendcl)
