using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using XRAI;

/// <summary>
/// Unity component to load and visualize XRAI format files
/// </summary>
public class XRAILoader : MonoBehaviour
{
    [Header("XRAI File Settings")]
    [Tooltip("Path to XRAI file (relative to StreamingAssets folder)")]
    public string xraiFilePath = "demo.xrai";
    
    [Tooltip("Load file on start")]
    public bool loadOnStart = true;
    
    [Header("Visualization Settings")]
    [Tooltip("Parent transform for loaded objects")]
    public Transform contentParent;
    
    [Tooltip("Default material for meshes without materials")]
    public Material defaultMaterial;
    
    // Internal references
    private XRAIDecoder decoder;
    private Dictionary<string, object> xraiData;
    private Dictionary<string, Material> materials = new Dictionary<string, Material>();
    private Dictionary<string, Mesh> meshes = new Dictionary<string, Mesh>();
    private Dictionary<string, GameObject> gameObjects = new Dictionary<string, GameObject>();
    
    // Start is called before the first frame update
    void Start()
    {
        // Initialize decoder
        decoder = new XRAIDecoder();
        
        // Create content parent if not assigned
        if (contentParent == null)
        {
            GameObject parent = new GameObject("XRAI Content");
            contentParent = parent.transform;
            contentParent.SetParent(transform);
        }
        
        // Create default material if not assigned
        if (defaultMaterial == null)
        {
            defaultMaterial = new Material(Shader.Find("Standard"));
            defaultMaterial.color = Color.gray;
        }
        
        // Load file if enabled
        if (loadOnStart)
        {
            LoadXRAIFile(xraiFilePath);
        }
    }
    
    /// <summary>
    /// Load an XRAI file from StreamingAssets
    /// </summary>
    /// <param name="filePath">Path relative to StreamingAssets</param>
    public void LoadXRAIFile(string filePath)
    {
        string fullPath = Path.Combine(Application.streamingAssetsPath, filePath);
        
        try
        {
            // Clear existing content
            ClearContent();
            
            // Load and decode XRAI file
            xraiData = decoder.Decode(fullPath);
            
            // Log success
            Debug.Log($"Successfully loaded XRAI file: {filePath}");
            
            // Process XRAI data
            ProcessXRAIData();
        }
        catch (System.Exception ex)
        {
            Debug.LogError($"Error loading XRAI file: {ex.Message}");
        }
    }
    
    /// <summary>
    /// Clear all loaded content
    /// </summary>
    public void ClearContent()
    {
        // Clear dictionaries
        materials.Clear();
        meshes.Clear();
        gameObjects.Clear();
        
        // Destroy all children
        while (contentParent.childCount > 0)
        {
            DestroyImmediate(contentParent.GetChild(0).gameObject);
        }
    }
    
    /// <summary>
    /// Process loaded XRAI data
    /// </summary>
    private void ProcessXRAIData()
    {
        // Process materials first
        ProcessMaterials();
        
        // Process geometries
        ProcessGeometries();
        
        // Process scene
        ProcessScene();
        
        // Process AI components
        ProcessAIComponents();
    }
    
    /// <summary>
    /// Process materials from XRAI data
    /// </summary>
    private void ProcessMaterials()
    {
        if (!xraiData.TryGetValue("materials", out object materialsObj))
        {
            return;
        }
        
        // Handle both array and single object
        IEnumerable<object> materialsList;
        
        if (materialsObj is List<object> list)
        {
            materialsList = list;
        }
        else if (materialsObj is Dictionary<string, object> dict)
        {
            materialsList = new List<object> { dict };
        }
        else
        {
            Debug.LogWarning("Invalid materials format");
            return;
        }
        
        // Process each material
        foreach (object materialObj in materialsList)
        {
            if (materialObj is Dictionary<string, object> materialDict)
            {
                // Get material ID
                if (!materialDict.TryGetValue("id", out object idObj) || !(idObj is string id))
                {
                    continue;
                }
                
                // Get material type
                string materialType = "standard";
                if (materialDict.TryGetValue("type", out object typeObj) && typeObj is string type)
                {
                    materialType = type.ToLower();
                }
                
                // Create material based on type
                Material material;
                
                switch (materialType)
                {
                    case "standard":
                        material = new Material(Shader.Find("Standard"));
                        break;
                    case "unlit":
                        material = new Material(Shader.Find("Unlit/Color"));
                        break;
                    default:
                        material = new Material(Shader.Find("Standard"));
                        break;
                }
                
                // Apply properties
                foreach (var kvp in materialDict)
                {
                    string key = kvp.Key;
                    object value = kvp.Value;
                    
                    if (key == "id" || key == "type")
                    {
                        continue;
                    }
                    
                    // Handle common properties
                    if (key == "color" && value is List<object> colorList && colorList.Count >= 3)
                    {
                        float r = System.Convert.ToSingle(colorList[0]);
                        float g = System.Convert.ToSingle(colorList[1]);
                        float b = System.Convert.ToSingle(colorList[2]);
                        float a = colorList.Count >= 4 ? System.Convert.ToSingle(colorList[3]) : 1.0f;
                        
                        material.color = new Color(r, g, b, a);
                    }
                    else if (key == "metallic" && value is double metallicValue)
                    {
                        material.SetFloat("_Metallic", (float)metallicValue);
                    }
                    else if (key == "roughness" && value is double roughnessValue)
                    {
                        material.SetFloat("_Glossiness", 1.0f - (float)roughnessValue);
                    }
                    else if (key == "emissive" && value is List<object> emissiveList && emissiveList.Count >= 3)
                    {
                        float r = System.Convert.ToSingle(emissiveList[0]);
                        float g = System.Convert.ToSingle(emissiveList[1]);
                        float b = System.Convert.ToSingle(emissiveList[2]);
                        
                        material.SetColor("_EmissionColor", new Color(r, g, b));
                        material.EnableKeyword("_EMISSION");
                    }
                }
                
                // Add to materials dictionary
                materials[id] = material;
                Debug.Log($"Created material: {id}");
            }
        }
    }
    
    /// <summary>
    /// Process geometries from XRAI data
    /// </summary>
    private void ProcessGeometries()
    {
        if (!xraiData.TryGetValue("geometry", out object geometryObj))
        {
            return;
        }
        
        // Handle both array and single object
        IEnumerable<object> geometryList;
        
        if (geometryObj is List<object> list)
        {
            geometryList = list;
        }
        else if (geometryObj is Dictionary<string, object> dict)
        {
            geometryList = new List<object> { dict };
        }
        else
        {
            Debug.LogWarning("Invalid geometry format");
            return;
        }
        
        // Process each geometry
        foreach (object geoObj in geometryList)
        {
            if (geoObj is Dictionary<string, object> geoDict)
            {
                // Get geometry ID
                if (!geoDict.TryGetValue("id", out object idObj) || !(idObj is string id))
                {
                    continue;
                }
                
                // Get geometry type
                string geometryType = "mesh";
                if (geoDict.TryGetValue("type", out object typeObj) && typeObj is string type)
                {
                    geometryType = type.ToLower();
                }
                
                // Create mesh based on type
                Mesh mesh = new Mesh();
                
                switch (geometryType)
                {
                    case "box":
                        float width = 1f, height = 1f, depth = 1f;
                        
                        if (geoDict.TryGetValue("width", out object widthObj) && widthObj is double widthVal)
                        {
                            width = (float)widthVal;
                        }
                        
                        if (geoDict.TryGetValue("height", out object heightObj) && heightObj is double heightVal)
                        {
                            height = (float)heightVal;
                        }
                        
                        if (geoDict.TryGetValue("depth", out object depthObj) && depthObj is double depthVal)
                        {
                            depth = (float)depthVal;
                        }
                        
                        mesh = CreateBoxMesh(width, height, depth);
                        break;
                        
                    case "sphere":
                        float radius = 1f;
                        int segments = 32;
                        
                        if (geoDict.TryGetValue("radius", out object radiusObj) && radiusObj is double radiusVal)
                        {
                            radius = (float)radiusVal;
                        }
                        
                        if (geoDict.TryGetValue("segments", out object segmentsObj) && segmentsObj is long segmentsVal)
                        {
                            segments = (int)segmentsVal;
                        }
                        
                        mesh = CreateSphereMesh(radius, segments);
                        break;
                        
                    case "mesh":
                        // Create custom mesh from vertices and triangles
                        if (geoDict.TryGetValue("vertices", out object verticesObj) && 
                            geoDict.TryGetValue("triangles", out object trianglesObj))
                        {
                            mesh = CreateCustomMesh(verticesObj, trianglesObj);
                        }
                        break;
                        
                    default:
                        mesh = CreateBoxMesh(1f, 1f, 1f);
                        break;
                }
                
                // Add to meshes dictionary
                meshes[id] = mesh;
                Debug.Log($"Created mesh: {id}");
            }
        }
    }
    
    /// <summary>
    /// Process scene from XRAI data
    /// </summary>
    private void ProcessScene()
    {
        if (!xraiData.TryGetValue("scene", out object sceneObj))
        {
            // If no scene data, create a demo scene
            CreateDemoScene();
            return;
        }
        
        if (sceneObj is Dictionary<string, object> sceneDict)
        {
            // Process nodes
            if (sceneDict.TryGetValue("nodes", out object nodesObj) && nodesObj is List<object> nodesList)
            {
                foreach (object nodeObj in nodesList)
                {
                    if (nodeObj is Dictionary<string, object> nodeDict)
                    {
                        GameObject nodeGO = CreateNode(nodeDict, contentParent);
                        
                        // Add to gameObjects dictionary if it has an ID
                        if (nodeDict.TryGetValue("id", out object idObj) && idObj is string id)
                        {
                            gameObjects[id] = nodeGO;
                        }
                    }
                }
            }
        }
    }
    
    /// <summary>
    /// Process AI components from XRAI data
    /// </summary>
    private void ProcessAIComponents()
    {
        if (!xraiData.TryGetValue("aiComponents", out object aiObj))
        {
            return;
        }
        
        if (aiObj is Dictionary<string, object> aiDict)
        {
            // Create AI controller
            GameObject aiController = new GameObject("AI Controller");
            aiController.transform.SetParent(contentParent);
            
            // Add AI component script
            XRAIAIController controller = aiController.AddComponent<XRAIAIController>();
            
            // Set AI data
            controller.SetAIData(aiDict);
            
            Debug.Log("Added AI components");
        }
    }
    
    /// <summary>
    /// Create a node from XRAI data
    /// </summary>
    /// <param name="nodeDict">Node data</param>
    /// <param name="parent">Parent transform</param>
    /// <returns>Created GameObject</returns>
    private GameObject CreateNode(Dictionary<string, object> nodeDict, Transform parent)
    {
        // Get node properties
        string name = "XRAI Node";
        if (nodeDict.TryGetValue("name", out object nameObj) && nameObj is string nameStr)
        {
            name = nameStr;
        }
        
        string type = "group";
        if (nodeDict.TryGetValue("type", out object typeObj) && typeObj is string typeStr)
        {
            type = typeStr.ToLower();
        }
        
        // Create GameObject
        GameObject nodeGO = new GameObject(name);
        nodeGO.transform.SetParent(parent);
        
        // Set transform
        if (nodeDict.TryGetValue("position", out object posObj) && posObj is List<object> posList && posList.Count >= 3)
        {
            float x = System.Convert.ToSingle(posList[0]);
            float y = System.Convert.ToSingle(posList[1]);
            float z = System.Convert.ToSingle(posList[2]);
            
            nodeGO.transform.localPosition = new Vector3(x, y, z);
        }
        
        if (nodeDict.TryGetValue("rotation", out object rotObj) && rotObj is List<object> rotList && rotList.Count >= 3)
        {
            float x = System.Convert.ToSingle(rotList[0]);
            float y = System.Convert.ToSingle(rotList[1]);
            float z = System.Convert.ToSingle(rotList[2]);
            
            nodeGO.transform.localEulerAngles = new Vector3(x, y, z);
        }
        
        if (nodeDict.TryGetValue("scale", out object scaleObj) && scaleObj is List<object> scaleList && scaleList.Count >= 3)
        {
            float x = System.Convert.ToSingle(scaleList[0]);
            float y = System.Convert.ToSingle(scaleList[1]);
            float z = System.Convert.ToSingle(scaleList[2]);
            
            nodeGO.transform.localScale = new Vector3(x, y, z);
        }
        
        // Process based on type
        switch (type)
        {
            case "mesh":
                // Get geometry
                Mesh mesh = null;
                if (nodeDict.TryGetValue("geometry", out object geoObj) && geoObj is string geoId)
                {
                    meshes.TryGetValue(geoId, out mesh);
                }
                
                // Get material
                Material material = defaultMaterial;
                if (nodeDict.TryGetValue("material", out object matObj) && matObj is string matId)
                {
                    materials.TryGetValue(matId, out material);
                }
                
                // Create mesh renderer and filter
                if (mesh != null)
                {
                    MeshFilter meshFilter = nodeGO.AddComponent<MeshFilter>();
                    meshFilter.sharedMesh = mesh;
                    
                    MeshRenderer meshRenderer = nodeGO.AddComponent<MeshRenderer>();
                    meshRenderer.sharedMaterial = material;
                    
                    // Add collider
                    nodeGO.AddComponent<MeshCollider>();
                }
                break;
                
            case "light":
                // Get light properties
                string lightType = "point";
                if (nodeDict.TryGetValue("lightType", out object lightTypeObj) && lightTypeObj is string lightTypeStr)
                {
                    lightType = lightTypeStr.ToLower();
                }
                
                Color lightColor = Color.white;
                if (nodeDict.TryGetValue("color", out object lightColorObj) && lightColorObj is List<object> lightColorList && lightColorList.Count >= 3)
                {
                    float r = System.Convert.ToSingle(lightColorList[0]);
                    float g = System.Convert.ToSingle(lightColorList[1]);
                    float b = System.Convert.ToSingle(lightColorList[2]);
                    
                    lightColor = new Color(r, g, b);
                }
                
                float intensity = 1f;
                if (nodeDict.TryGetValue("intensity", out object intensityObj) && intensityObj is double intensityVal)
                {
                    intensity = (float)intensityVal;
                }
                
                // Create light
                Light light = nodeGO.AddComponent<Light>();
                light.color = lightColor;
                light.intensity = intensity;
                
                // Set light type
                switch (lightType)
                {
                    case "point":
                        light.type = LightType.Point;
                        break;
                    case "spot":
                        light.type = LightType.Spot;
                        break;
                    case "directional":
                        light.type = LightType.Directional;
                        break;
                    default:
                        light.type = LightType.Point;
                        break;
                }
                break;
        }
        
        // Process children
        if (nodeDict.TryGetValue("children", out object childrenObj) && childrenObj is List<object> childrenList)
        {
            foreach (object childObj in childrenList)
            {
                if (childObj is Dictionary<string, object> childDict)
                {
                    CreateNode(childDict, nodeGO.transform);
                }
            }
        }
        
        return nodeGO;
    }
    
    /// <summary>
    /// Create a demo scene when no scene data is provided
    /// </summary>
    private void CreateDemoScene()
    {
        Debug.Log("Creating demo scene");
        
        // Create a floor
        GameObject floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
        floor.name = "Floor";
        floor.transform.SetParent(contentParent);
        floor.transform.localScale = new Vector3(5, 1, 5);
        
        // Create objects from loaded meshes and materials
        float offset = -meshes.Count * 0.5f;
        
        foreach (var kvp in meshes)
        {
            string meshId = kvp.Key;
            Mesh mesh = kvp.Value;
            
            // Create GameObject
            GameObject obj = new GameObject(meshId);
            obj.transform.SetParent(contentParent);
            obj.transform.localPosition = new Vector3(offset, 1, 0);
            
            // Add mesh components
            MeshFilter meshFilter = obj.AddComponent<MeshFilter>();
            meshFilter.sharedMesh = mesh;
            
            MeshRenderer meshRenderer = obj.AddComponent<MeshRenderer>();
            
            // Try to find a material
            Material material = defaultMaterial;
            if (materials.Count > 0)
            {
                // Get a random material
                int index = Mathf.FloorToInt(Random.value * materials.Count);
                material = materials.Values.GetEnumerator().Current;
                for (int i = 0; i < index && materials.Values.GetEnumerator().MoveNext(); i++)
                {
                    material = materials.Values.GetEnumerator().Current;
                }
            }
            
            meshRenderer.sharedMaterial = material;
            
            // Add collider
            obj.AddComponent<MeshCollider>();
            
            // Add to gameObjects dictionary
            gameObjects[meshId] = obj;
            
            offset += 2f;
        }
        
        // If no meshes were loaded, create default objects
        if (meshes.Count == 0)
        {
            // Create a cube
            GameObject cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cube.name = "Cube";
            cube.transform.SetParent(contentParent);
            cube.transform.localPosition = new Vector3(-1, 0.5f, 0);
            
            // Create a sphere
            GameObject sphere = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            sphere.name = "Sphere";
            sphere.transform.SetParent(contentParent);
            sphere.transform.localPosition = new Vector3(1, 0.5f, 0);
        }
        
        // Add a light
        GameObject light = new GameObject("Light");
        light.transform.SetParent(contentParent);
        light.transform.localPosition = new Vector3(0, 3, 0);
        
        Light lightComponent = light.AddComponent<Light>();
        lightComponent.type = LightType.Point;
        lightComponent.color = Color.white;
        lightComponent.intensity = 1.5f;
    }
    
    /// <summary>
    /// Create a box mesh
    /// </summary>
    private Mesh CreateBoxMesh(float width, float height, float depth)
    {
        Mesh mesh = new Mesh();
        
        // Use Unity's primitive mesh creation
        GameObject tempObj = GameObject.CreatePrimitive(PrimitiveType.Cube);
        MeshFilter tempMeshFilter = tempObj.GetComponent<MeshFilter>();
        mesh.Copy(tempMeshFilter.sharedMesh);
        DestroyImmediate(tempObj);
        
        // Scale to desired dimensions
        Vector3[] vertices = mesh.vertices;
        for (int i = 0; i < vertices.Length; i++)
        {
            vertices[i].x *= width * 0.5f;
            vertices[i].y *= height * 0.5f;
            vertices[i].z *= depth * 0.5f;
        }
        mesh.vertices = vertices;
        
        mesh.RecalculateBounds();
        mesh.RecalculateNormals();
        
        return mesh;
    }
    
    /// <summary>
    /// Create a sphere mesh
    /// </summary>
    private Mesh CreateSphereMesh(float radius, int segments)
    {
        Mesh mesh = new Mesh();
        
        // Use Unity's primitive mesh creation
        GameObject tempObj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        MeshFilter tempMeshFilter = tempObj.GetComponent<MeshFilter>();
        mesh.Copy(tempMeshFilter.sharedMesh);
        DestroyImmediate(tempObj);
        
        // Scale to desired radius
        Vector3[] vertices = mesh.vertices;
        for (int i = 0; i < vertices.Length; i++)
        {
            vertices[i] *= radius;
        }
        mesh.vertices = vertices;
        
        mesh.RecalculateBounds();
        
        return mesh;
    }
    
    /// <summary>
    /// Create a custom mesh from vertices and triangles
    /// </summary>
    private Mesh CreateCustomMesh(object verticesObj, object trianglesObj)
    {
        Mesh mesh = new Mesh();
        
        // Process vertices
        if (verticesObj is List<object> verticesList)
        {
            Vector3[] vertices = new Vector3[verticesList.Count / 3];
            
            for (int i = 0; i < vertices.Length; i++)
            {
                int baseIndex = i * 3;
                if (baseIndex + 2 < verticesList.Count)
                {
                    float x = System.Convert.ToSingle(verticesList[baseIndex]);
                    float y = System.Convert.ToSingle(verticesList[baseIndex + 1]);
                    float z = System.Convert.ToSingle(verticesList[baseIndex + 2]);
                    
                    vertices[i] = new Vector3(x, y, z);
                }
            }
            
            mesh.vertices = vertices;
        }
        
        // Process triangles
        if (trianglesObj is List<object> trianglesList)
        {
            List<int> indices = new List<int>();
            
            foreach (object triangleObj in trianglesList)
            {
                if (triangleObj is List<object> triangle && triangle.Count >= 3)
                {
                    indices.Add(System.Convert.ToInt32(triangle[0]));
                    indices.Add(System.Convert.ToInt32(triangle[1]));
                    indices.Add(System.Convert.ToInt32(triangle[2]));
                }
            }
            
            mesh.SetIndices(indices.ToArray(), MeshTopology.Triangles, 0);
        }
        
        mesh.RecalculateBounds();
        mesh.RecalculateNormals();
        
        return mesh;
    }
}
